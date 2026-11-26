import { NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import {
  EDA_LIMITS,
  parseCsvText,
  profileDataset,
  generateAutomatedInsights,
  sampleRowsForCharts,
} from "@/lib/math/eda-engine";

export async function POST(req: Request) {
  let tempFilePath: string | null = null;
  try {
    const contentType = req.headers.get("content-type") || "";
    let csvText = "";
    let fileName = "uploaded_dataset.csv";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "No CSV file uploaded." }, { status: 400 });
      }
      fileName = file.name || fileName;
      const ext = path.extname(fileName).toLowerCase();
      if (![".csv", ".tsv", ".txt"].includes(ext) && file.type && !file.type.includes("csv") && !file.type.includes("text")) {
        return NextResponse.json({ error: "Unsupported file format. Please upload a .csv file." }, { status: 400 });
      }
      if (file.size > EDA_LIMITS.MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File size exceeds the ${Math.round(EDA_LIMITS.MAX_FILE_BYTES / (1024 * 1024))} MB limit.` },
          { status: 413 }
        );
      }

      const tempDir = path.join(os.tmpdir(), "mathoml-eda-uploads");
      await fs.promises.mkdir(tempDir, { recursive: true });
      tempFilePath = path.join(tempDir, `next_upload_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.csv`);
      const buf = Buffer.from(await file.arrayBuffer());
      await fs.promises.writeFile(tempFilePath, buf);
      csvText = await fs.promises.readFile(tempFilePath, "utf8");
    } else {
      const body = await req.json();
      if (!body || typeof body.csvContent !== "string") {
        return NextResponse.json({ error: "Provide csvContent or multipart file." }, { status: 400 });
      }
      fileName = typeof body.fileName === "string" ? body.fileName : fileName;
      if (Buffer.byteLength(body.csvContent, "utf8") > EDA_LIMITS.MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `CSV exceeds ${Math.round(EDA_LIMITS.MAX_FILE_BYTES / (1024 * 1024))} MB limit.` },
          { status: 413 }
        );
      }
      csvText = body.csvContent;
    }

    const parsed = parseCsvText(csvText, fileName);
    const profile = profileDataset(parsed.name, parsed.headers, parsed.rows);
    const insights = generateAutomatedInsights(profile);
    const sample = sampleRowsForCharts(parsed.rows);

    return NextResponse.json({
      success: true,
      sessionId: `local_${crypto.randomBytes(8).toString("hex")}`,
      datasetId: parsed.id,
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
    return NextResponse.json({ error: err?.message || "CSV upload processing failed." }, { status: 400 });
  } finally {
    if (tempFilePath) {
      await fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }
}
