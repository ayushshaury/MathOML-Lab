import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import { createWorker } from "tesseract.js";

export interface DetectedQuestion {
  id: string;
  index: number;
  raw: string;
  equation: string;
  type: "equation" | "derivative" | "integral" | "algebra" | "matrix";
  category?: "quadratic" | "linear" | "derivative" | "integral" | "rational" | "algebra" | "matrix" | "determinant" | "inverse" | "eigen";
  formattedTex?: string;
}

/**
 * Attempts to run Pix2Text Python OCR for high-fidelity formula detection.
 */
async function tryPix2Text(buffer: Buffer): Promise<{ rawText: string; questions: DetectedQuestion[] } | null> {
  const candidateScripts = [
    path.resolve(process.cwd(), "scripts", "pix2text_ocr.py"),
    path.resolve(process.cwd(), "backend", "scripts", "pix2text_ocr.py"),
    path.resolve(process.cwd(), "..", "backend", "scripts", "pix2text_ocr.py"),
  ];
  const scriptPath = candidateScripts.find((p) => fs.existsSync(p));
  if (!scriptPath) return null;

  const tempFile = path.join(os.tmpdir(), `p2t_be_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  try {
    await fs.promises.writeFile(tempFile, buffer);
    return await new Promise((resolve) => {
      const py = spawn("python", [scriptPath, tempFile]);
      let stdout = "";
      py.stdout.on("data", (d) => { stdout += d.toString(); });
      const timer = setTimeout(() => {
        try { py.kill(); } catch {}
        resolve(null);
      }, 2000);

      py.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout) {
          try {
            const data = JSON.parse(stdout);
            if (data.success && Array.isArray(data.questions) && data.questions.length > 0) {
              const questions: DetectedQuestion[] = data.questions.map((q: any, i: number) => {
                const eq = cleanMathExpression(q.clean || q.raw);
                const { type, category } = classifyMathQuestion(eq, q.raw);
                return {
                  id: `q_${i + 1}`,
                  index: i + 1,
                  raw: q.raw,
                  equation: eq,
                  type: q.type || type,
                  category,
                  formattedTex: toDisplayTex(eq),
                };
              });
              resolve({ rawText: data.text || stdout, questions });
              return;
            }
          } catch {}
        }
        resolve(null);
      });
      py.on("error", () => {
        clearTimeout(timer);
        resolve(null);
      });
    });
  } catch {
    return null;
  } finally {
    try { await fs.promises.unlink(tempFile); } catch {}
  }
}

const STOP_WORDS = new Set([
  "solve", "solving", "find", "finding", "calculate", "calculating", "evaluate", "evaluating",
  "differentiate", "differentiating", "integrate", "integrating", "determine", "determining",
  "simplify", "simplifying", "compute", "computing", "show", "prove", "check", "verify",
  "consider", "suppose", "assume", "graph", "plot", "factor", "factoring", "expand", "expanding",
  "problem", "question", "exercise", "ex", "task", "equation", "expression", "function",
  "formula", "value", "roots", "root", "zeros", "zero", "solution", "solutions", "derivative",
  "integral", "integrand", "differential", "system", "polynomial", "quadratic", "linear",
  "variable", "variables", "answer", "result", "worksheet", "page", "test", "exam", "homework",
  "for", "where", "if", "when", "then", "with", "respect", "to", "of", "in", "from", "by",
  "at", "on", "as", "such", "that", "which", "whose", "what", "who", "how", "is", "are",
  "was", "were", "be", "been", "being", "has", "have", "had", "does", "do", "did", "can",
  "could", "should", "would", "may", "might", "must", "shall", "will", "its", "their",
  "his", "her", "the", "a", "an", "and", "or", "but", "not", "nor", "so", "yet", "both",
  "either", "neither", "each", "every", "all", "any", "some", "given", "following", "below",
  "above", "here", "there", "let", "between", "among", "sole", "salve", "dermative", "derivatve",
  "diferentiate", "integrl", "nt", "two", "three", "four", "one"
]);

function isMathToken(token: string): boolean {
  const t = token.replace(/^[\(\[\{\$\"\'\`]+|[\)\]\}\$\.\,\?\!\;\"\'\`]+$/g, "");
  if (!t) return false;
  const lower = t.toLowerCase();
  if (STOP_WORDS.has(lower)) return false;
  if (/^[a-zA-Z]{3,}$/.test(t) && !/^(sin|cos|tan|sec|csc|cot|log|ln|exp|sqrt|abs|asin|acos|atan|sinh|cosh|tanh)$/i.test(t)) {
    return false;
  }
  if (/[0-9\+\-\*\/\^\=√∫≤≥π\(\)\[\]]/.test(t)) return true;
  if (/^[xyztabcuvwkmnrpq]$/i.test(t)) return true;
  return false;
}

/**
 * Normalizes and purifies mathematical expressions from noisy OCR strings
 * into valid Computer Algebra System (CAS) inputs.
 */
export function cleanMathExpression(raw: string): string {
  let s = raw.trim();

  // 1. Strip question numbers e.g. "1.", "1)", "(a)", "Q1:", "Problem 1:", "No. 1"
  s = s.replace(/^(?:(?:problem|question|no\.?|q|exercise|ex\.?)\s*)?(?:[0-9]+|[a-zA-Z])(?:\.|\)|\:|\-)\s*/i, "").trim();

  // 2. Convert LaTeX fractions & notation to standard CAS syntax
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

  // 3. Normalize mathematical Unicode characters
  s = s.replace(/[\u2212\u2013\u2014\u2015\u002D\uFF0D_]/g, "-");
  s = s.replace(/[×·∗•%]/g, "*");
  s = s.replace(/[÷]/g, "/");
  s = s.replace(/√/g, "sqrt");
  s = s.replace(/π/g, "pi");
  s = s.replace(/∞/g, "Infinity");
  s = s.replace(/≤/g, "<=").replace(/≥/g, ">=");
  s = s.replace(/∫/g, "int");

  // 4. Convert unicode superscripts
  s = s.replace(/⁰/g, "^0").replace(/¹/g, "^1").replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁴/g, "^4")
       .replace(/⁵/g, "^5").replace(/⁶/g, "^6").replace(/⁷/g, "^7").replace(/⁸/g, "^8").replace(/⁹/g, "^9");

  // 5. Fix OCR exponent misreads: x"2, x'2, x~2 -> x^2
  s = s.replace(/([a-zA-Z0-9\)])["'`~]+([0-9]+)/g, "$1^$2");

  // 6. Fix standalone variable + single digit exponent: x2 -> x^2, x3 -> x^3, y2 -> y^2
  s = s.replace(/\b([a-zA-Z])([0-9])\b/g, "$1^$2");

  // 7. Fix OCR letter misread 't' or 'T' between operands as '+'
  s = s.replace(/([0-9a-zA-Z\^\)])\s+[tT]\s+([0-9a-zA-Z\(])/g, "$1 + $2");

  // 8. Fix OCR 'O' or 'o' for zero after equals or digits
  s = s.replace(/=\s*[Oo]\b/g, "= 0");
  s = s.replace(/\b[Oo]\s*=/g, "0 =");

  // 9. Fix implicit multiplication: 2x -> 2*x, 3( -> 3*(
  s = s.replace(/\b([0-9]+)\s*([a-zA-Z])\b/g, "$1*$2");
  s = s.replace(/([0-9])\s*\(/g, "$1*(");
  s = s.replace(/\)\s*([0-9a-zA-Z])/g, ")*$1");
  s = s.replace(/\)\s*\(/g, ")*(");

  // Exclude function names from x( -> x*(
  s = s.replace(/\b(?!(?:sin|cos|tan|log|ln|sqrt|exp|int|diff|sec|csc|cot)\b)([a-zA-Z])\s*\(/g, "$1*(");

  // Preserve differential `) dx`
  s = s.replace(/\)\*d([a-zA-Z])\b/g, ") d$1");

  // 10. Normalize double equals / colons
  s = s.replace(/==+/g, "=");
  s = s.replace(/\s*::\s*/g, " = ");

  return s.trim();
}

/**
 * Detects and parses matrix notations from LaTeX environments, bracketed arrays,
 * or MATLAB semicolon notation into normalized 2D number arrays.
 */
export function parseMatrixFromText(raw: string): {
  matrix: number[][];
  isDet: boolean;
  equation: string;
  formattedTex: string;
} | null {
  if (!raw) return null;
  const str = raw.trim();

  // 1. LaTeX matrix environment: \begin{pmatrix/bmatrix/matrix/vmatrix/Bmatrix} ... \end{...}
  const latexMatch = str.match(/\\begin\{(pmatrix|bmatrix|matrix|vmatrix|Bmatrix)\}([\s\S]*?)\\end\{\1\}/i);
  if (latexMatch) {
    const env = latexMatch[1].toLowerCase();
    const body = latexMatch[2].trim();
    const rowStrings = body.split(/\\\\|\n/).map((r) => r.trim()).filter(Boolean);
    const rows: number[][] = [];
    for (const r of rowStrings) {
      const cells = r.split("&").map((c) => parseFloat(c.trim())).filter((n) => !isNaN(n));
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length >= 1 && rows.every((r) => r.length === rows[0].length)) {
      const isDet = env === "vmatrix";
      const matStr = `[${rows.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
      return {
        matrix: rows,
        isDet,
        equation: isDet ? `det(${matStr})` : matStr,
        formattedTex: isDet
          ? `\\begin{vmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{vmatrix}`
          : `\\begin{pmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`,
      };
    }
  }

  // 2. Bracketed array notation: [[1, 2], [3, 4]]
  if (str.includes("[[") && str.includes("]]")) {
    const match = str.match(/\[\s*(\[\s*[-0-9\.\s\,]+\s*\](?:\s*,\s*\[\s*[-0-9\.\s\,]+\s*\])*)\s*\]/);
    if (match) {
      const inner = match[1];
      const rowMatches = inner.match(/\[\s*([-0-9\.\s\,]+)\s*\]/g);
      if (rowMatches && rowMatches.length > 0) {
        const rows: number[][] = [];
        for (const rm of rowMatches) {
          const content = rm.replace(/^\[|\]$/g, "").trim();
          const cells = content.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
          if (cells.length > 0) rows.push(cells);
        }
        if (rows.length >= 1 && rows.every((r) => r.length === rows[0].length)) {
          const isDet = /\b(?:det|determinant)\b/i.test(str);
          const matStr = `[${rows.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
          return {
            matrix: rows,
            isDet,
            equation: isDet ? `det(${matStr})` : matStr,
            formattedTex: `\\begin{pmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`,
          };
        }
      }
    }
  }

  // 3. MATLAB / Mathjs semicolon notation: [1 2; 3 4] or [1, 2 ; 3, 4]
  const semiMatch = str.match(/\[\s*([-0-9\.\s\,\;]+)\s*\]/);
  if (semiMatch && semiMatch[1].includes(";")) {
    const rowStrings = semiMatch[1].split(";").map((r) => r.trim()).filter(Boolean);
    const rows: number[][] = [];
    for (const r of rowStrings) {
      const cells = r.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length >= 2 && rows.every((r) => r.length === rows[0].length)) {
      const isDet = /\b(?:det|determinant)\b/i.test(str);
      const matStr = `[${rows.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
      return {
        matrix: rows,
        isDet,
        equation: isDet ? `det(${matStr})` : matStr,
        formattedTex: `\\begin{pmatrix} ${rows.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`,
      };
    }
  }

  return null;
}

/**
 * Extracts a matrix expression or matrix operation from natural language text
 */
export function extractMatrixFromSentence(sentence: string): {
  type: "matrix";
  category: "matrix" | "determinant" | "inverse" | "eigen";
  equation: string;
  formattedTex: string;
} | null {
  // Check for matrix operation between two matrices: A + B, A - B, A * B
  const multiMatrixMatch = sentence.match(/(\[\[[\s\S]*?\]\]|\b[A-Za-z]\b)\s*([\+\-\*])\s*(\[\[[\s\S]*?\]\]|\b[A-Za-z]\b)/);
  if (multiMatrixMatch && (multiMatrixMatch[1].includes("[[") || multiMatrixMatch[3].includes("[[") || multiMatrixMatch[0].includes(";"))) {
    const m1 = parseMatrixFromText(multiMatrixMatch[1]);
    const op = multiMatrixMatch[2];
    const m2 = parseMatrixFromText(multiMatrixMatch[3]);
    if (m1 && m2) {
      const s1 = `[${m1.matrix.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
      const s2 = `[${m2.matrix.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
      return {
        type: "matrix",
        category: "matrix",
        equation: `${s1} ${op} ${s2}`,
        formattedTex: `${m1.formattedTex} ${op} ${m2.formattedTex}`,
      };
    }
  }

  const parsed = parseMatrixFromText(sentence);
  if (!parsed) return null;

  const matStr = `[${parsed.matrix.map((r) => `[${r.join(", ")}]`).join(", ")}]`;

  if (parsed.isDet || /\b(?:det|determinant|det\(|\|)\b/i.test(sentence)) {
    return {
      type: "matrix",
      category: "determinant",
      equation: `det(${matStr})`,
      formattedTex: `\\det ${parsed.formattedTex}`,
    };
  }
  if (/\b(?:inverse|inv|invertible|inv\(|\-1)\b/i.test(sentence)) {
    return {
      type: "matrix",
      category: "inverse",
      equation: `inv(${matStr})`,
      formattedTex: `${parsed.formattedTex}^{-1}`,
    };
  }
  if (/\b(?:eigen|eigenvalue|eigenvalues|eigenvector|eigenvectors)\b/i.test(sentence)) {
    return {
      type: "matrix",
      category: "eigen",
      equation: `eigen(${matStr})`,
      formattedTex: `\\operatorname{eigen}(${parsed.formattedTex})`,
    };
  }
  if (/\b(?:transpose|rank|trace)\b/i.test(sentence)) {
    const match = sentence.match(/\b(transpose|rank|trace)\b/i);
    const op = match ? match[1].toLowerCase() : "transpose";
    return {
      type: "matrix",
      category: "matrix",
      equation: `${op}(${matStr})`,
      formattedTex: `\\operatorname{${op}}(${parsed.formattedTex})`,
    };
  }

  return {
    type: "matrix",
    category: "matrix",
    equation: matStr,
    formattedTex: parsed.formattedTex,
  };
}

/**
 * Stitches consecutive multiline rows produced by OCR (e.g. '[ 1 2 ]\n[ 3 4 ]' or '| 1 2 |\n| 3 4 |')
 * or multiline LaTeX matrices into single unified matrix expressions.
 */
export function stitchMatrixLines(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if line looks like a matrix row (with optional prefix, e.g. "A = [ 1 2 ]" or "[ 1 2 ]")
    const prefixMatch = line.match(/^(.*?)([\[\|\(]\s*[-0-9\.\s\,]+\s*[\]\|\)])$/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const row1Str = prefixMatch[2];
      const openChar = row1Str[0];
      const closeChar = row1Str[row1Str.length - 1];
      const cells = row1Str.slice(1, -1).trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));

      if (cells.length >= 1) {
        const matrixRows = [cells];
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (nextLine.startsWith(openChar) && nextLine.endsWith(closeChar)) {
            const nextCells = nextLine.slice(1, -1).trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
            if (nextCells.length === cells.length) {
              matrixRows.push(nextCells);
              j++;
              continue;
            }
          }
          break;
        }

        if (matrixRows.length >= 2) {
          const isDet = (openChar === "|" && closeChar === "|") || /\b(?:det|determinant)\b/i.test(prefix);
          const matStr = `[${matrixRows.map((r) => `[${r.join(", ")}]`).join(", ")}]`;
          const finalExpr = isDet ? `det(${matStr})` : matStr;
          result.push((prefix.trim() ? prefix.trim() + " " : "") + finalExpr);
          i = j;
          continue;
        }
      }
    }

    // Check for multiline LaTeX matrix
    if (/\\begin\{(pmatrix|bmatrix|matrix|vmatrix|Bmatrix)\}/i.test(line) && !/\\end\{(pmatrix|bmatrix|matrix|vmatrix|Bmatrix)\}/i.test(line)) {
      let combined = line;
      let j = i + 1;
      while (j < lines.length) {
        combined += " " + lines[j];
        if (/\\end\{(pmatrix|bmatrix|matrix|vmatrix|Bmatrix)\}/i.test(lines[j])) {
          j++;
          break;
        }
        j++;
      }
      result.push(combined);
      i = j;
      continue;
    }

    result.push(line);
    i++;
  }

  return result;
}

/**
 * Extracts isolated mathematical equation or expression from natural language sentence
 */
export function extractEquationFromSentence(sentence: string): { type: "equation" | "derivative" | "integral" | "algebra" | "matrix"; equation: string; formattedTex?: string; category?: any } | null {
  let s = sentence.trim();
  s = s.replace(/^(?:(?:problem|question|no\.?|q|exercise|ex\.?)\s*)?(?:[0-9]+|[a-zA-Z])(?:\.|\)|\:|\-)\s*/i, "").trim();

  // 0. Matrix detection: LaTeX matrices, bracketed arrays, or matrix questions
  const matrixExtracted = extractMatrixFromSentence(s);
  if (matrixExtracted) {
    return matrixExtracted;
  }

  // 1. Calculus derivative prompt: e.g. 'derivative of ... with respect to ...'
  if (/\b(?:derivative|differentiate|diff|dermative|dy\/dx|d\/dx)\b/i.test(s)) {
    const m = s.match(/(?:(?:derivative|differentiate|diff|dermative)\s+(?:of\s+)?|d\/dx\s*(?:\[|\()?\s*|dy\/dx\s*(?:=|of)?\s*)([a-zA-Z0-9\s\+\-\*\/\^\(\)\[\]\.\√]+?)(?:\s+with\s+respect|\s+at\s+|\s+when|\s*[\]\)]|\s*[,;\.\?!]|$)/i);
    if (m && m[1]) {
      let expr = m[1].replace(/^(?:y|f\(x\))\s*=\s*/i, "").trim();
      const tokens = expr.split(/\s+/).filter(isMathToken);
      if (tokens.length > 0) {
        const cleaned = cleanMathExpression(tokens.join(" "));
        return { type: "derivative", equation: `d/dx [${cleaned}]` };
      }
    }
  }

  // 2. Calculus integral prompt: e.g. 'integral of ... dx' or 'int (...) dx'
  if (/\b(?:integral|integrate|int|nt|∫)\b/i.test(s)) {
    const m = s.match(/(?:(?:integral|integrate)\s*(?:of\s+)?|(?:int|nt|∫)\s*)([a-zA-Z0-9\s\+\-\*\/\^\(\)\[\]\.\√]+?)(?:\s*d[a-zA-Z]|\s*[,;\.\?!]|$)/i);
    if (m && m[1]) {
      const tokens = m[1].split(/\s+/).filter(isMathToken);
      if (tokens.length > 0) {
        const cleaned = cleanMathExpression(tokens.join(" "));
        return { type: "integral", equation: `int (${cleaned}) dx` };
      }
    }
  }

  // 3. Equation with '='
  if (s.includes("=")) {
    const parts = s.split("=");
    const lhsRaw = parts[0].trim();
    const rhsRaw = parts.slice(1).join("=").trim();

    // From '=' walk backwards on LHS
    const lhsWords = lhsRaw.split(/\s+/);
    const lhsMath: string[] = [];
    for (let i = lhsWords.length - 1; i >= 0; i--) {
      const w = lhsWords[i];
      if (isMathToken(w)) {
        lhsMath.unshift(w.replace(/^[\(\[\{\$\"\'\`]+/, ""));
      } else {
        break;
      }
    }

    // From '=' walk forwards on RHS
    const rhsWords = rhsRaw.split(/\s+/);
    const rhsMath: string[] = [];
    for (let i = 0; i < rhsWords.length; i++) {
      const w = rhsWords[i];
      if (isMathToken(w)) {
        rhsMath.push(w.replace(/[\)\]\}\$\.\,\?\!\;\"\'\`]+$/, ""));
      } else {
        break;
      }
    }

    if (lhsMath.length > 0 && rhsMath.length > 0) {
      let lhs = lhsMath.join(" ");
      let rhs = rhsMath.join(" ");
      if (/^(?:f\(x\)|y)$/i.test(lhs) && /\b(?:derivative|diff)\b/i.test(sentence)) {
        return { type: "derivative", equation: `d/dx [${cleanMathExpression(rhs)}]` };
      }
      lhs = cleanMathExpression(lhs);
      rhs = cleanMathExpression(rhs);
      return { type: "equation", equation: `${lhs} = ${rhs}` };
    }
  }

  // 4. Expression without '='
  const allTokens = s.split(/\s+/).filter(isMathToken);
  if (allTokens.length > 0) {
    const cleaned = cleanMathExpression(allTokens.join(" "));
    if (cleaned.length >= 2) {
      return { type: "algebra", equation: cleaned };
    }
  }

  return null;
}

/**
 * Classifies the mathematical category of the question
 */
export function classifyMathQuestion(equation: string, raw: string): {
  type: "equation" | "derivative" | "integral" | "algebra" | "matrix";
  category?: "quadratic" | "linear" | "derivative" | "integral" | "rational" | "algebra" | "matrix" | "determinant" | "inverse" | "eigen";
} {
  if (equation.includes("[[") || equation.startsWith("det(") || equation.startsWith("inv(") || equation.startsWith("eigen(") || equation.includes(";")) {
    if (/\b(?:det|determinant)\b/i.test(raw) || equation.startsWith("det(")) {
      return { type: "matrix", category: "determinant" };
    }
    if (/\b(?:inv|inverse)\b/i.test(raw) || equation.startsWith("inv(")) {
      return { type: "matrix", category: "inverse" };
    }
    if (/\b(?:eigen)\b/i.test(raw) || equation.startsWith("eigen(")) {
      return { type: "matrix", category: "eigen" };
    }
    return { type: "matrix", category: "matrix" };
  }
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
  let tex = expr;

  // Convert embedded matrix arrays [[...]] to LaTeX pmatrix
  const matMatches = tex.match(/\[\s*\[\s*[-0-9\.\s\,]+\s*\](?:\s*,\s*\[\s*[-0-9\.\s\,]+\s*\])*\s*\]/g);
  if (matMatches) {
    for (const m of matMatches) {
      const parsed = parseMatrixFromText(m);
      if (parsed) {
        tex = tex.replace(m, parsed.formattedTex);
      }
    }
    if (expr.startsWith("det(") && expr.endsWith(")")) {
      tex = tex.replace(/^det\((.*)\)$/, "\\det $1");
    } else if (expr.startsWith("inv(") && expr.endsWith(")")) {
      tex = tex.replace(/^inv\((.*)\)$/, "{$1}^{-1}");
    } else if (expr.startsWith("eigen(") && expr.endsWith(")")) {
      tex = tex.replace(/^eigen\((.*)\)$/, "\\operatorname{eigen}($1)");
    }
    return tex;
  }

  tex = tex
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
 * Multi-question segmentation with equation-extraction from natural language text
 */
export function parseAllQuestions(fullText: string): DetectedQuestion[] {
  const rawLines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lines = stitchMatrixLines(rawLines);
  const questions: DetectedQuestion[] = [];

  let idx = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Filter headers or title lines that have no math operators or numbers
    const hasMathOperator = /[0-9\+\-\*\/\^\=\(\)\[\]\|√∫≤≥π]/.test(line);
    if (!hasMathOperator) {
      continue;
    }

    if (/^(page|test|exam|date|name|homework|math|class|section|worksheet)\b/i.test(line) && !line.includes("=") && !line.includes("+") && !line.includes("-") && !line.includes("[")) {
      continue;
    }

    // Try extracting isolated equation or matrix from this sentence
    const extracted = extractEquationFromSentence(line);
    if (extracted && extracted.equation && extracted.equation.length >= 2) {
      const { type, category } = classifyMathQuestion(extracted.equation, line);
      questions.push({
        id: `q_${idx}`,
        index: idx,
        raw: line,
        equation: extracted.equation,
        type: extracted.type || type,
        category: extracted.category || category,
        formattedTex: extracted.formattedTex || toDisplayTex(extracted.equation),
      });
      idx++;
      continue;
    }

    // Fallback if line is raw math or matrix
    const fallbackClean = cleanMathExpression(line);
    if (fallbackClean.length >= 2 && /[0-9xyztabc\+\-\*\/\^\=\(\)\[\]\|∫]/i.test(fallbackClean)) {
      const { type, category } = classifyMathQuestion(fallbackClean, line);
      questions.push({
        id: `q_${idx}`,
        index: idx,
        raw: line,
        equation: fallbackClean,
        type,
        category,
        formattedTex: toDisplayTex(fallbackClean),
      });
      idx++;
    }
  }

  return questions;
}

export async function processOcrBuffer(buffer: Buffer): Promise<{ rawText: string; questions: DetectedQuestion[] }> {
  // 0. High-accuracy AI Math Detection via Pix2Text (Primary Engine)
  try {
    const pixResult = await tryPix2Text(buffer);
    if (pixResult && pixResult.questions.length > 0) {
      return pixResult;
    }
  } catch {
    // Continue to local Tesseract fallback
  }

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
        tessedit_char_whitelist: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/=^()[]{}|√∫∑.,:; π \\&_",
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
