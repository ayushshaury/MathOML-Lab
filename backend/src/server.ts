import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { processOcrBuffer } from "./ocr.js";

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

// Start Server
const server = app.listen(PORT, () => {
  console.log(`🚀 MathOML Render Backend listening on port ${PORT}`);
  console.log(`🌐 Health check available at: http://localhost:${PORT}/health`);
});

// Graceful Shutdown for Render
const handleShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("Server closed. Process terminated.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export default app;
