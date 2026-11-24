import path from "path";
import fs from "fs";
import { createWorker } from "tesseract.js";

export interface DetectedQuestion {
  id: string;
  index: number;
  raw: string;
  equation: string;
  type: "equation" | "derivative" | "integral" | "algebra";
  category?: "quadratic" | "linear" | "derivative" | "integral" | "rational" | "algebra";
  formattedTex?: string;
}

/**
 * Normalizes and purifies mathematical expressions from noisy OCR strings
 * into valid Computer Algebra System (CAS) inputs.
 */
export function cleanMathExpression(raw: string): string {
  let s = raw.trim();

  // 1. Strip question numbers e.g. "1.", "1)", "(a)", "Q1:", "Problem 1:", "No. 1"
  s = s.replace(/^(?:(?:problem|question|no\.?|q|exercise|ex\.?)\s*)?(?:[0-9]+|[a-zA-Z])(?:\.|\)|\:|\-)\s*/i, "").trim();

  // 2. Strip English task instruction headers repeatedly (up to 3 passes for nested instructions)
  for (let iter = 0; iter < 3; iter++) {
    s = s.replace(/^(?:solve(?:\s+for\s+[a-z]\b)?|find(?:\s+the)?\s+(?:roots|zeros|solutions|value(?:\s+of)?(?:\s+[a-z]\b)?|derivative|integral|limit|[a-z]\b)|differentiate|integrate|evaluate|calculate|simplify|determine|factor|expand)\s*(?:the\s+(?:following\s+)?(?:equation|expression|integral|derivative|value))?\s*(?:of|for|in)?\s*[\:\-]?\s*/i, "").trim();
  }

  // 3. Strip any residual leading action prefixes
  s = s.replace(/^(?:derivative|integral|equation|solve|calculate|evaluate)\s*[\:\-]\s*/i, "").trim();

  // 4. Transform natural language derivative prompts e.g. "dy/dx of y = sin(x)*cos(x)" -> "d/dx [sin(x)*cos(x)]"
  if (/^dy\/dx\s+(?:of\s+)?(?:y\s*=\s*)?/i.test(s)) {
    const expr = s.replace(/^dy\/dx\s+(?:of\s+)?(?:y\s*=\s*)?/i, "").trim();
    s = `d/dx [${expr}]`;
  }

  // 5. Convert LaTeX fractions & notation to standard CAS syntax
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "(($1)/($2))");
  s = s.replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, "(($1)/($2))");
  s = s.replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)");
  s = s.replace(/\\sqrt\[([0-9]+)\]\{([^}]+)\}/g, "($2)^(1/$1)");
  s = s.replace(/\\cdot|\\times/g, "*");
  s = s.replace(/\\div/g, "/");
  s = s.replace(/\\pm/g, "+-");
  s = s.replace(/\\le/g, "<=").replace(/\\ge/g, ">=").replace(/\\ne/g, "!=");
  s = s.replace(/\\pi/g, "pi").replace(/\\infty/g, "Infinity");
  s = s.replace(/\\int/g, "int");
  s = s.replace(/\\left|\\right/g, "");

  // 6. Normalize mathematical Unicode characters
  s = s.replace(/[\u2212\u2013\u2014\u2015\u002D\uFF0D_]/g, "-");
  s = s.replace(/[×·∗•%]/g, "*");
  s = s.replace(/[÷]/g, "/");
  s = s.replace(/√/g, "sqrt");
  s = s.replace(/π/g, "pi");
  s = s.replace(/∞/g, "Infinity");
  s = s.replace(/≤/g, "<=").replace(/≥/g, ">=");
  s = s.replace(/∫/g, "int");

  // 7. Convert unicode superscripts
  s = s.replace(/⁰/g, "^0").replace(/¹/g, "^1").replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4")
       .replace(/⁵/g, "^5").replace(/⁶/g, "^6").replace(/⁷/g, "^7").replace(/⁸/g, "^8").replace(/⁹/g, "^9");

  // 8. Fix OCR exponent misreads: x"2, x'2, x~2 -> x^2
  s = s.replace(/([a-zA-Z0-9\)])["'`~]+([0-9]+)/g, "$1^$2");

  // 9. Fix standalone variable + single digit exponent: x2 -> x^2, x3 -> x^3, y2 -> y^2
  s = s.replace(/\b([a-zA-Z])([0-9])\b/g, "$1^$2");

  // 10. Fix OCR letter misread 't' or 'T' between operands as '+'
  s = s.replace(/([0-9a-zA-Z\^\)])\s+[tT]\s+([0-9a-zA-Z\(])/g, "$1 + $2");

  // 11. Fix OCR 'O' or 'o' for zero after equals or digits
  s = s.replace(/=\s*[Oo]\b/g, "= 0");
  s = s.replace(/\b[Oo]\s*=/g, "0 =");

  // 12. Fix implicit multiplication: 2x -> 2*x, 3( -> 3*(
  s = s.replace(/\b([0-9]+)\s*([a-zA-Z])\b/g, "$1*$2");
  s = s.replace(/([0-9])\s*\(/g, "$1*(");
  s = s.replace(/\)\s*([0-9a-zA-Z])/g, ")*$1");
  s = s.replace(/\)\s*\(/g, ")*(");

  // Exclude function names from x( -> x*(
  s = s.replace(/\b(?!(?:sin|cos|tan|log|ln|sqrt|exp|int|diff|sec|csc|cot)\b)([a-zA-Z])\s*\(/g, "$1*(");

  // Preserve differential `) dx`
  s = s.replace(/\)\*d([a-zA-Z])\b/g, ") d$1");

  // 13. Normalize double equals / colons
  s = s.replace(/==+/g, "=");
  s = s.replace(/\s*::\s*/g, " = ");

  return s.trim();
}

/**
 * Classifies the mathematical category of the question
 */
export function classifyMathQuestion(equation: string, raw: string): {
  type: "equation" | "derivative" | "integral" | "algebra";
  category: "quadratic" | "linear" | "derivative" | "integral" | "rational" | "algebra";
} {
  if (/\b(d\/dx|dy\/dx|diff|deriv)\b/i.test(equation) || /\bderivative\b/i.test(raw) || /\bdifferentiate\b/i.test(raw)) {
    return { type: "derivative", category: "derivative" };
  }
  if (/\b(int|integral)\b/i.test(equation) || equation.includes("∫") || /\bintegral\b/i.test(raw) || /\bintegrate\b/i.test(raw)) {
    return { type: "integral", category: "integral" };
  }
  if (equation.includes("=")) {
    if (/\^[2-9]|\^2|\^3/.test(equation)) {
      return { type: "equation", category: "quadratic" };
    }
    return { type: "equation", category: "linear" };
  }
  if (equation.includes("/")) {
    return { type: "algebra", category: "rational" };
  }
  return { type: "algebra", category: "algebra" };
}

/**
 * Converts cleaned expression into readable KaTeX math for display
 */
export function toDisplayTex(expr: string): string {
  let tex = expr
    .replace(/\*/g, " \\cdot ")
    .replace(/\bsqrt\(([^()]*)\)/g, "\\sqrt{$1}")
    .replace(/\bpi\b/g, "\\pi ")
    .replace(/\bInfinity\b/g, "\\infty ")
    .replace(/<=/g, "\\le ")
    .replace(/>=/g, "\\ge ")
    .replace(/!=/g, "\\ne ")
    .replace(/\+-/g, "\\pm ")
    .replace(/\^\(([^()]*)\)/g, "^{$1}")
    .replace(/\^([0-9a-zA-Z])/g, "^{$1}");

  if (tex.startsWith("d/dx [") && tex.endsWith("]")) {
    const inner = tex.slice(6, -1);
    tex = `\\frac{d}{dx}\\left[${inner}\\right]`;
  } else if (tex.startsWith("int ") && tex.endsWith(" dx")) {
    const inner = tex.slice(4, -3);
    tex = `\\int ${inner}\\, dx`;
  }
  return tex;
}

/**
 * Multi-question segmentation with prompt-grouping
 */
export function parseAllQuestions(fullText: string): DetectedQuestion[] {
  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const questions: DetectedQuestion[] = [];

  let idx = 1;
  let pendingPrompt = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Filter headers or title lines that have no math operators or numbers
    const hasMathOperator = /[0-9\+\-\*\/\^\=\(\)√∫≤≥π]/.test(line);
    if (!hasMathOperator) {
      continue;
    }

    if (/^(page|test|exam|date|name|homework|math|class|section|worksheet)\b/i.test(line) && !line.includes("=") && !line.includes("+") && !line.includes("-")) {
      continue;
    }

    // Check if line is purely an instruction/prompt e.g. "Problem 1: Solve for x:"
    const isPromptOnly = /^(?:(?:problem|question|no\.?|q|exercise)\s*)?(?:[0-9]+|[a-zA-Z])(?:\.|\)|\:|\-)?\s*(?:solve|find|differentiate|integrate|evaluate|calculate|simplify|determine|factor)/i.test(line) && !line.includes("=") && !line.includes("+") && !line.includes("-");
    if (isPromptOnly) {
      pendingPrompt = line;
      continue;
    }

    const fullLine = pendingPrompt ? `${pendingPrompt} ${line}` : line;
    pendingPrompt = "";

    const clean = cleanMathExpression(fullLine);
    if (clean.length < 2) continue;
    if (!/[0-9xyztabc\+\-\*\/\^\=\(\)∫]/i.test(clean)) continue;

    const { type, category } = classifyMathQuestion(clean, fullLine);

    questions.push({
      id: `q_${idx}`,
      index: idx,
      raw: fullLine,
      equation: clean,
      type,
      category,
      formattedTex: toDisplayTex(clean),
    });
    idx++;
  }

  return questions;
}

export async function processOcrBuffer(buffer: Buffer): Promise<{ rawText: string; questions: DetectedQuestion[] }> {
  let activeWorker: any = null;
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), "backend"),
      path.resolve(process.cwd()),
    ];
    let langPath = process.cwd();
    for (const p of candidatePaths) {
      if (fs.existsSync(path.join(p, "eng.traineddata"))) {
        langPath = p;
        break;
      }
    }

    const workerPath = path.resolve(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js");

    const recognitionPromise = (async () => {
      const w = await createWorker("eng", 1, {
        workerPath: fs.existsSync(workerPath) ? workerPath : undefined,
        langPath,
        gzip: false,
      });
      activeWorker = w;

      await w.setParameters({
        tessedit_char_whitelist: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/=^()[]{}√∫∑.,:; π ",
      });

      const result = await w.recognize(buffer);
      return result.data.text ?? "";
    })();

    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error("OCR engine timed out after 12 seconds")), 12000);
    });

    const rawText = (await Promise.race([recognitionPromise, timeoutPromise])).trim();
    if (!rawText) {
      throw new Error("No mathematical text or equations could be detected in the image.");
    }

    let questions = parseAllQuestions(rawText);
    if (questions.length === 0) {
      const fallbackClean = cleanMathExpression(rawText.replace(/\n+/g, " "));
      if (fallbackClean.length >= 2) {
        const { type, category } = classifyMathQuestion(fallbackClean, rawText);
        questions = [
          {
            id: "q_1",
            index: 1,
            raw: rawText,
            equation: fallbackClean,
            type,
            category,
            formattedTex: toDisplayTex(fallbackClean),
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
