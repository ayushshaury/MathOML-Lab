import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";
import { processOcrBuffer } from "./ocr.js";
import {
  EDA_LIMITS,
  parseCsvText,
  profileDataset,
  generateAutomatedInsights,
  sampleRowsForCharts,
  applyTransformation,
  exportDatasetToCsv,
  type DataRow,
  type TransformationAction,
} from "./eda-engine.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// CORS configuration for Vercel frontend
app.use(
  cors({
    origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(","),
    credentials: true,
  })
);

// High payload limit for base64 worksheet images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Root welcome & API info
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "MathOML Backend Service",
    status: "active",
    deployTarget: "Render Web Service",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      ocr: "POST /api/ocr",
      edaUpload: "POST /api/eda/upload",
      edaAnalyze: "POST /api/eda/analyze",
      edaTransform: "POST /api/eda/transform",
      edaExportCsv: "POST /api/eda/export/csv",
    },
  });
});

// Render Healthcheck endpoint
app.get(["/health", "/api/health"], (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "mathoml-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Math OCR Queue Endpoint
app.post("/api/ocr", async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== "string" || !image.startsWith("data:image")) {
      return res.status(400).json({
        error: "Please provide a valid base64 image string (data:image/...;base64,...).",
      });
    }

    const base64Data = image.split(",")[1];
    if (!base64Data) {
      return res.status(400).json({ error: "Invalid base64 image data." });
    }

    const buffer = Buffer.from(base64Data, "base64");
    const { rawText, questions } = await processOcrBuffer(buffer);

    return res.status(200).json({
      success: true,
      text: rawText,
      questions,
    });
  } catch (err: any) {
    const message = err?.message || "Internal OCR processing error.";
    return res.status(500).json({ error: message });
  }
});

// ============================================================================
// Automated EDA Endpoints (Session-Isolated, Safe Temp Handling)
// ============================================================================

const EDA_TEMP_DIR = path.join(os.tmpdir(), "mathoml-eda-uploads");
try {
  fs.mkdirSync(EDA_TEMP_DIR, { recursive: true });
} catch {}

interface DatasetSnapshot {
  headers: string[];
  rows: DataRow[];
  description: string;
}

interface EdaDatasetRecord {
  datasetId: string;
  sessionId: string;
  name: string;
  original: { headers: string[]; rows: DataRow[] };
  working: { headers: string[]; rows: DataRow[] };
  undoStack: DatasetSnapshot[];
  redoStack: DatasetSnapshot[];
  historyLog: { timestamp: string; action: string }[];
  createdAt: number;
  lastAccessedAt: number;
}

const EDA_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_STORED_DATASETS = 60;
const edaDatasetStore = new Map<string, EdaDatasetRecord>();

// Periodic cleanup of expired datasets & stray temp files
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, rec] of edaDatasetStore.entries()) {
    if (now - rec.lastAccessedAt > EDA_SESSION_TTL_MS) {
      edaDatasetStore.delete(id);
    }
  }
}, 10 * 60 * 1000);
cleanupInterval.unref();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        fs.mkdirSync(EDA_TEMP_DIR, { recursive: true });
        cb(null, EDA_TEMP_DIR);
      } catch (e) {
        cb(e as Error, EDA_TEMP_DIR);
      }
    },
    filename: (_req, _file, cb) => {
      cb(null, `upload_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.csv`);
    },
  }),
  limits: {
    fileSize: EDA_LIMITS.MAX_FILE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowedMime = [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "text/plain",
      "text/tab-separated-values",
      "application/octet-stream",
    ];
    if ([".csv", ".tsv", ".txt"].includes(ext) || allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file format. Please upload a valid .csv file."));
    }
  },
});

function getOrCreateSessionId(req: Request): string {
  const provided = req.header("x-eda-session");
  if (provided && /^[a-f0-9]{24,64}$/i.test(provided)) {
    return provided;
  }
  return crypto.randomBytes(24).toString("hex");
}

function getAuthorizedRecord(req: Request, datasetId: string): EdaDatasetRecord {
  const sessionId = req.header("x-eda-session") || (req.body?.sessionId as string);
  if (!sessionId || !datasetId) {
    const err = new Error("Missing session or dataset authorization token.") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  const rec = edaDatasetStore.get(datasetId);
  if (!rec) {
    const err = new Error("Dataset session expired or not found. Please re-upload your CSV.") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  if (rec.sessionId !== sessionId) {
    const err = new Error("Access denied: you are not authorized to access this dataset.") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  rec.lastAccessedAt = Date.now();
  return rec;
}

function evictIfNeeded(): void {
  if (edaDatasetStore.size < MAX_STORED_DATASETS) return;
  let oldestId: string | null = null;
  let oldestTime = Infinity;
  for (const [id, rec] of edaDatasetStore.entries()) {
    if (rec.lastAccessedAt < oldestTime) {
      oldestTime = rec.lastAccessedAt;
      oldestId = id;
    }
  }
  if (oldestId) edaDatasetStore.delete(oldestId);
}

app.post(
  "/api/eda/upload",
  (req: Request, res: Response, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      upload.single("file")(req, res, (err: any) => {
        if (err) {
          return res.status(400).json({ error: err.message || "File upload failed validation." });
        }
        next();
      });
    } else {
      next();
    }
  },
  async (req: Request, res: Response) => {
    const tempFilePath = req.file?.path;
    try {
      const sessionId = getOrCreateSessionId(req);
      let csvText = "";
      let fileName = "uploaded_dataset.csv";

      if (tempFilePath) {
        fileName = req.file?.originalname || fileName;
        csvText = await fs.promises.readFile(tempFilePath, "utf8");
      } else if (req.body && typeof req.body.csvContent === "string") {
        fileName = typeof req.body.fileName === "string" ? req.body.fileName : fileName;
        if (Buffer.byteLength(req.body.csvContent, "utf8") > EDA_LIMITS.MAX_FILE_BYTES) {
          return res.status(413).json({
            error: `CSV size exceeds maximum allowed limit of ${Math.round(EDA_LIMITS.MAX_FILE_BYTES / (1024 * 1024))} MB.`,
          });
        }
        csvText = req.body.csvContent;
      } else {
        return res.status(400).json({ error: "Provide a CSV file (multipart/form-data) or csvContent payload." });
      }

      const parsed = parseCsvText(csvText, fileName);
      const profile = profileDataset(parsed.name, parsed.headers, parsed.rows);
      const insights = generateAutomatedInsights(profile);
      const sample = sampleRowsForCharts(parsed.rows);

      evictIfNeeded();
      const datasetId = `ds_${crypto.randomBytes(12).toString("hex")}`;
      const record: EdaDatasetRecord = {
        datasetId,
        sessionId,
        name: parsed.name,
        original: { headers: [...parsed.headers], rows: parsed.rows.map((r) => ({ ...r })) },
        working: { headers: [...parsed.headers], rows: parsed.rows.map((r) => ({ ...r })) },
        undoStack: [],
        redoStack: [],
        historyLog: [],
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };
      edaDatasetStore.set(datasetId, record);

      return res.status(200).json({
        success: true,
        sessionId,
        datasetId,
        warnings: parsed.warnings,
        profile,
        insights,
        sampleInfo: {
          isSampled: sample.isSampled,
          renderedRows: sample.sampledRows.length,
          totalRows: sample.originalCount,
        },
        rows: parsed.rows,
        previewRows: parsed.rows.slice(0, 50),
      });
    } catch (err: any) {
      return res.status(err?.status || 400).json({ error: err?.message || "Failed to parse CSV file." });
    } finally {
      if (tempFilePath) {
        await fs.promises.unlink(tempFilePath).catch(() => {});
      }
    }
  }
);

app.post("/api/eda/analyze", (req: Request, res: Response) => {
  try {
    const { datasetId } = req.body || {};
    const rec = getAuthorizedRecord(req, datasetId);
    const profile = profileDataset(rec.name, rec.working.headers, rec.working.rows);
    const insights = generateAutomatedInsights(profile);
    const sample = sampleRowsForCharts(rec.working.rows);
    return res.status(200).json({
      success: true,
      datasetId: rec.datasetId,
      profile,
      insights,
      sampleInfo: {
        isSampled: sample.isSampled,
        renderedRows: sample.sampledRows.length,
        totalRows: sample.originalCount,
      },
      previewRows: rec.working.rows.slice(0, 50),
    });
  } catch (err: any) {
    return res.status(err?.status || 400).json({ error: err?.message || "Failed to analyze dataset." });
  }
});

app.post("/api/eda/transform", (req: Request, res: Response) => {
  try {
    const { datasetId, mode, action } = req.body || {};
    const rec = getAuthorizedRecord(req, datasetId);

    if (mode === "undo") {
      const prev = rec.undoStack.pop();
      if (!prev) return res.status(400).json({ error: "Nothing to undo." });
      rec.redoStack.push({
        headers: [...rec.working.headers],
        rows: rec.working.rows.map((r) => ({ ...r })),
        description: "Redo checkpoint",
      });
      rec.working = { headers: prev.headers, rows: prev.rows };
      rec.historyLog.push({ timestamp: new Date().toISOString(), action: `Undo: ${prev.description}` });
    } else if (mode === "redo") {
      const next = rec.redoStack.pop();
      if (!next) return res.status(400).json({ error: "Nothing to redo." });
      rec.undoStack.push({
        headers: [...rec.working.headers],
        rows: rec.working.rows.map((r) => ({ ...r })),
        description: "Undo checkpoint",
      });
      rec.working = { headers: next.headers, rows: next.rows };
      rec.historyLog.push({ timestamp: new Date().toISOString(), action: "Redo operation" });
    } else if (mode === "reset") {
      rec.undoStack.push({
        headers: [...rec.working.headers],
        rows: rec.working.rows.map((r) => ({ ...r })),
        description: "Before reset to original",
      });
      rec.redoStack = [];
      rec.working = {
        headers: [...rec.original.headers],
        rows: rec.original.rows.map((r) => ({ ...r })),
      };
      rec.historyLog.push({ timestamp: new Date().toISOString(), action: "Restored original dataset" });
    } else if (action) {
      const prevSnapshot: DatasetSnapshot = {
        headers: [...rec.working.headers],
        rows: rec.working.rows.map((r) => ({ ...r })),
        description: "",
      };
      const result = applyTransformation(rec.working.headers, rec.working.rows, action as TransformationAction);
      prevSnapshot.description = result.description;
      rec.undoStack.push(prevSnapshot);
      if (rec.undoStack.length > 20) rec.undoStack.shift();
      rec.redoStack = [];
      rec.working = { headers: result.headers, rows: result.rows };
      rec.historyLog.push({ timestamp: new Date().toISOString(), action: result.description });
    } else {
      return res.status(400).json({ error: "Invalid transform request." });
    }

    const profile = profileDataset(rec.name, rec.working.headers, rec.working.rows);
    const insights = generateAutomatedInsights(profile);
    return res.status(200).json({
      success: true,
      datasetId: rec.datasetId,
      profile,
      insights,
      canUndo: rec.undoStack.length > 0,
      canRedo: rec.redoStack.length > 0,
      historyLog: rec.historyLog,
      rows: rec.working.rows,
    });
  } catch (err: any) {
    return res.status(err?.status || 400).json({ error: err?.message || "Transformation failed." });
  }
});

app.post("/api/eda/export/csv", (req: Request, res: Response) => {
  try {
    const { datasetId } = req.body || {};
    const rec = getAuthorizedRecord(req, datasetId);
    const csv = exportDatasetToCsv(rec.working.headers, rec.working.rows);
    const safeName = rec.name.replace(/[^a-z0-9_-]/gi, "_") || "processed_dataset";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_cleaned.csv"`);
    return res.status(200).send(csv);
  } catch (err: any) {
    return res.status(err?.status || 400).json({ error: err?.message || "CSV export failed." });
  }
});

// Start Server (unless disabled for headless Express unit integration tests)
const server =
  process.env.MATHOML_NO_LISTEN === "true"
    ? null
    : app.listen(PORT, () => {
        console.log(`🚀 MathOML Render Backend listening on port ${PORT}`);
        console.log(`🌐 Health check available at: http://localhost:${PORT}/health`);
      });

// Graceful Shutdown for Render
const handleShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  clearInterval(cleanupInterval);
  if (!server) {
    process.exit(0);
  }
  server.close(() => {
    console.log("Server closed. Process terminated.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export default app;
