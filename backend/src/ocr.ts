import path from "path";
import { createWorker } from "tesseract.js";

export interface DetectedQuestion {
  id: string;
  index: number;
  raw: string;
  equation: string;
  type: "equation" | "derivative" | "integral" | "algebra";
}

export function cleanMathExpression(raw: string): string {
  let s = raw.trim();
  // Strip question numbers e.g. "1.", "1)", "(a)", "Q1:", "Problem 1:", "No. 1"
  s = s.replace(/^(problem|question|no\.?|q)?[0-9]+[\.\)\:\-]\s*|^[a-zA-Z][\.\)]\s*|^Q[0-9]+[\.\:\s]*/i, "").trim();

  // Normalize mathematical symbols
  s = s.replace(/[\u2212\u2013\u2014]/g, "-");
  s = s.replace(/[×·∗]/g, "*");
  s = s.replace(/[÷]/g, "/");
  s = s.replace(/√/g, "sqrt");
  s = s.replace(/π/g, "pi");
  s = s.replace(/∞/g, "Infinity");
  s = s.replace(/≤/g, "<=").replace(/≥/g, ">=");

  // Convert unicode superscripts
  s = s.replace(/⁰/g, "^0").replace(/¹/g, "^1").replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4")
       .replace(/⁵/g, "^5").replace(/⁶/g, "^6").replace(/⁷/g, "^7").replace(/⁸/g, "^8").replace(/⁹/g, "^9");

  // Fix common OCR letter misreads in math context
  s = s.replace(/\b([0-9]+)\s*([a-zA-Z])\b/g, "$1*$2");
  s = s.replace(/([0-9a-zA-Z])\s*\(/g, "$1*(");
  s = s.replace(/\)\s*([0-9a-zA-Z])/g, ")*$1");
  s = s.replace(/==+/g, "=");

  return s.trim();
}

export function parseAllQuestions(fullText: string): DetectedQuestion[] {
  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions: DetectedQuestion[] = [];

  let idx = 1;

  for (const line of lines) {
    // Filter out common header words if there are no math symbols
    if (/^(page|test|exam|date|name|homework|math|class|section|worksheet)\b/i.test(line) && !line.includes("=") && !line.includes("+") && !line.includes("-")) {
      continue;
    }

    const clean = cleanMathExpression(line);
    if (clean.length < 2) continue;
    if (!/[0-9xyztabc\+\-\*\/\^\=\(\)∫]/i.test(clean)) continue;

    let type: "equation" | "derivative" | "integral" | "algebra" = "algebra";
    if (clean.includes("=")) {
      type = "equation";
    } else if (/\b(d\/dx|dy\/dx|diff|deriv)\b/i.test(clean) || clean.includes("'")) {
      type = "derivative";
    } else if (/\b(int|integral)\b/i.test(clean) || clean.includes("∫")) {
      type = "integral";
    }

    questions.push({
      id: `q_${idx}`,
      index: idx,
      raw: line,
      equation: clean,
      type,
    });
    idx++;
  }

  return questions;
}

export async function processOcrBuffer(buffer: Buffer): Promise<{ rawText: string; questions: DetectedQuestion[] }> {
  let activeWorker: any = null;
  try {
    const workerPath = path.resolve(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js");

    const recognitionPromise = (async () => {
      const w = await createWorker("eng", 1, {
        workerPath: workerPath,
      });
      activeWorker = w;
      const result = await w.recognize(buffer);
      return result.data.text ?? "";
    })();

    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error("OCR engine timed out after 12 seconds")), 12000);
    });

    const rawText = (await Promise.race([recognitionPromise, timeoutPromise])).trim();
    if (!rawText) {
      throw new Error("No text or equations could be detected in the image.");
    }

    let questions = parseAllQuestions(rawText);
    if (questions.length === 0) {
      const fallbackClean = cleanMathExpression(rawText.replace(/\n+/g, " "));
      if (fallbackClean.length >= 2) {
        questions = [
          {
            id: "q_1",
            index: 1,
            raw: rawText,
            equation: fallbackClean,
            type: fallbackClean.includes("=") ? "equation" : "algebra",
          },
        ];
      }
    }

    return { rawText, questions };
  } finally {
    if (activeWorker && typeof activeWorker.terminate === "function") {
      try {
        await activeWorker.terminate();
      } catch {}
    }
  }
}
