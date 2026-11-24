// End-to-end test of matrix OCR processing

function parseMatrixFromText(raw) {
  if (!raw) return null;
  const str = raw.trim();

  // 1. LaTeX matrix environment: \begin{pmatrix/bmatrix/matrix/vmatrix/Bmatrix} ... \end{...}
  const latexMatch = str.match(/\\begin\{(pmatrix|bmatrix|matrix|vmatrix|Bmatrix)\}([\s\S]*?)\\end\{\1\}/i);
  if (latexMatch) {
    const env = latexMatch[1].toLowerCase();
    const body = latexMatch[2].trim();
    const rowStrings = body.split(/\\\\|\n/).map(r => r.trim()).filter(Boolean);
    const rows = [];
    for (const r of rowStrings) {
      const cells = r.split('&').map(c => parseFloat(c.trim())).filter(n => !isNaN(n));
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length >= 1 && rows.every(r => r.length === rows[0].length)) {
      const isDet = env === 'vmatrix';
      const matStr = `[${rows.map(r => `[${r.join(', ')}]`).join(', ')}]`;
      return {
        matrix: rows,
        isDet,
        equation: isDet ? `det(${matStr})` : matStr,
        formattedTex: isDet
          ? `\\begin{vmatrix} ${rows.map(r => r.join(' & ')).join(' \\\\ ')} \\end{vmatrix}`
          : `\\begin{pmatrix} ${rows.map(r => r.join(' & ')).join(' \\\\ ')} \\end{pmatrix}`
      };
    }
  }

  // 2. Bracketed array notation: [[1, 2], [3, 4]]
  if (str.includes('[[') && str.includes(']]')) {
    const match = str.match(/\[\s*(\[\s*[-0-9\.\s\,]+\s*\](?:\s*,\s*\[\s*[-0-9\.\s\,]+\s*\])*)\s*\]/);
    if (match) {
      const inner = match[1];
      const rowMatches = inner.match(/\[\s*([-0-9\.\s\,]+)\s*\]/g);
      if (rowMatches && rowMatches.length > 0) {
        const rows = [];
        for (const rm of rowMatches) {
          const content = rm.replace(/^\[|\]$/g, '').trim();
          const cells = content.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
          if (cells.length > 0) rows.push(cells);
        }
        if (rows.length >= 1 && rows.every(r => r.length === rows[0].length)) {
          const isDet = /\b(?:det|determinant)\b/i.test(str);
          const matStr = `[${rows.map(r => `[${r.join(', ')}]`).join(', ')}]`;
          return {
            matrix: rows,
            isDet,
            equation: isDet ? `det(${matStr})` : matStr,
            formattedTex: `\\begin{pmatrix} ${rows.map(r => r.join(' & ')).join(' \\\\ ')} \\end{pmatrix}`
          };
        }
      }
    }
  }

  // 3. MATLAB / Mathjs semicolon notation: [1 2; 3 4] or [1, 2 ; 3, 4]
  const semiMatch = str.match(/\[\s*([-0-9\.\s\,\;]+)\s*\]/);
  if (semiMatch && semiMatch[1].includes(';')) {
    const rowStrings = semiMatch[1].split(';').map(r => r.trim()).filter(Boolean);
    const rows = [];
    for (const r of rowStrings) {
      const cells = r.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length >= 2 && rows.every(r => r.length === rows[0].length)) {
      const isDet = /\b(?:det|determinant)\b/i.test(str);
      const matStr = `[${rows.map(r => `[${r.join(', ')}]`).join(', ')}]`;
      return {
        matrix: rows,
        isDet,
        equation: isDet ? `det(${matStr})` : matStr,
        formattedTex: `\\begin{pmatrix} ${rows.map(r => r.join(' & ')).join(' \\\\ ')} \\end{pmatrix}`
      };
    }
  }

  return null;
}

function extractMatrixFromSentence(sentence) {
  // Check for matrix operation between two matrices: A + B, A - B, A * B
  const multiMatrixMatch = sentence.match(/(\[\[[\s\S]*?\]\]|\b[A-Za-z]\b)\s*([\+\-\*])\s*(\[\[[\s\S]*?\]\]|\b[A-Za-z]\b)/);
  if (multiMatrixMatch && (multiMatrixMatch[1].includes('[[') || multiMatrixMatch[3].includes('[[') || multiMatrixMatch[0].includes(';'))) {
    const m1 = parseMatrixFromText(multiMatrixMatch[1]);
    const op = multiMatrixMatch[2];
    const m2 = parseMatrixFromText(multiMatrixMatch[3]);
    if (m1 && m2) {
      const s1 = `[${m1.matrix.map(r => `[${r.join(', ')}]`).join(', ')}]`;
      const s2 = `[${m2.matrix.map(r => `[${r.join(', ')}]`).join(', ')}]`;
      return {
        type: 'matrix',
        category: 'matrix',
        equation: `${s1} ${op} ${s2}`,
        formattedTex: `${m1.formattedTex} ${op} ${m2.formattedTex}`
      };
    }
  }

  const parsed = parseMatrixFromText(sentence);
  if (!parsed) return null;

  const matStr = `[${parsed.matrix.map(r => `[${r.join(', ')}]`).join(', ')}]`;

  if (parsed.isDet || /\b(?:det|determinant|det\(|\|)\b/i.test(sentence)) {
    return {
      type: 'matrix',
      category: 'determinant',
      equation: `det(${matStr})`,
      formattedTex: `\\det ${parsed.formattedTex}`
    };
  }
  if (/\b(?:inverse|inv|invertible|inv\(|\-1)\b/i.test(sentence)) {
    return {
      type: 'matrix',
      category: 'inverse',
      equation: `inv(${matStr})`,
      formattedTex: `${parsed.formattedTex}^{-1}`
    };
  }
  if (/\b(?:eigen|eigenvalue|eigenvalues|eigenvector|eigenvectors)\b/i.test(sentence)) {
    return {
      type: 'matrix',
      category: 'eigen',
      equation: `eigen(${matStr})`,
      formattedTex: `\\operatorname{eigen}(${parsed.formattedTex})`
    };
  }
  if (/\b(?:transpose|rank|trace)\b/i.test(sentence)) {
    const op = sentence.match(/\b(transpose|rank|trace)\b/i)[1].toLowerCase();
    return {
      type: 'matrix',
      category: 'matrix',
      equation: `${op}(${matStr})`,
      formattedTex: `\\operatorname{${op}}(${parsed.formattedTex})`
    };
  }

  return {
    type: 'matrix',
    category: 'matrix',
    equation: matStr,
    formattedTex: parsed.formattedTex
  };
}

function toDisplayTex(expr) {
  if (!expr) return "";
  // If expr contains matrix [[1, 2], [3, 4]]
  const matMatch = expr.match(/\[\s*(\[\s*[-0-9\.\s\,]+\s*\](?:\s*,\s*\[\s*[-0-9\.\s\,]+\s*\])*)\s*\]/);
  if (matMatch) {
    const parsed = parseMatrixFromText(matMatch[0]);
    if (parsed) {
      if (expr.startsWith("det(") && expr.endsWith(")")) {
        return `\\det ${parsed.formattedTex}`;
      }
      if (expr.startsWith("inv(") && expr.endsWith(")")) {
        return `${parsed.formattedTex}^{-1}`;
      }
      if (expr.startsWith("eigen(") && expr.endsWith(")")) {
        return `\\operatorname{eigen}(${parsed.formattedTex})`;
      }
      return expr.replace(matMatch[0], parsed.formattedTex);
    }
  }

  return expr;
}

console.log('--- TEST: toDisplayTex ---');
console.log(toDisplayTex('det([[1, 2], [3, 4]])'));
console.log(toDisplayTex('inv([[1, 2], [3, 4]])'));
console.log(toDisplayTex('[[1, 2], [3, 4]]'));
console.log(toDisplayTex('[[1, 2], [3, 4]] + [[5, 6], [7, 8]]'));
