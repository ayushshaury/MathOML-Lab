// Comprehensive test for matrix parsing and OCR question extraction

function parseMatrixFromText(raw) {
  if (!raw) return null;
  let str = raw.trim();

  // 1. LaTeX matrix environment: \begin{pmatrix/bmatrix/matrix/vmatrix} ... \end{...}
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
      return {
        matrix: rows,
        isDet,
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
          return {
            matrix: rows,
            isDet: /\b(?:det|determinant)\b/i.test(str),
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
      return {
        matrix: rows,
        isDet: /\b(?:det|determinant)\b/i.test(str),
        formattedTex: `\\begin{pmatrix} ${rows.map(r => r.join(' & ')).join(' \\\\ ')} \\end{pmatrix}`
      };
    }
  }

  return null;
}

// Stitching consecutive multi-line OCR lines into single matrix
function stitchMatrixLines(lines) {
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line looks like a matrix row: e.g. [ 1  2 ], | 1  2 |, ( 1  2 )
    const rowMatch = line.match(/^([\[\|\(])\s*([0-9\.\-\s\,]+)\s*([\]\|\)])$/);
    if (rowMatch) {
      const openChar = rowMatch[1];
      const closeChar = rowMatch[3];
      const cells = rowMatch[2].trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));

      if (cells.length >= 1) {
        // Collect consecutive matching rows
        const matrixRows = [cells];
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextMatch = nextLine.match(/^([\[\|\(])\s*([0-9\.\-\s\,]+)\s*([\]\|\)])$/);
          if (nextMatch && nextMatch[1] === openChar && nextMatch[3] === closeChar) {
            const nextCells = nextMatch[2].trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            if (nextCells.length === cells.length) {
              matrixRows.push(nextCells);
              j++;
              continue;
            }
          }
          break;
        }

        // If we found 2 or more rows of equal length, stitch them!
        if (matrixRows.length >= 2) {
          const isDet = openChar === '|' && closeChar === '|';
          const matStr = `[${matrixRows.map(r => `[${r.join(', ')}]`).join(', ')}]`;
          const finalExpr = isDet ? `det(${matStr})` : matStr;
          result.push(finalExpr);
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
        combined += ' ' + lines[j];
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

// Run test cases
console.log('--- TEST 1: LaTeX pmatrix ---');
console.log(parseMatrixFromText('\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}'));

console.log('--- TEST 2: LaTeX vmatrix (Determinant) ---');
console.log(parseMatrixFromText('\\begin{vmatrix} 4 & -1 \\\\ 2 & 5 \\end{vmatrix}'));

console.log('--- TEST 3: Bracketed array ---');
console.log(parseMatrixFromText('[[1, 2], [3, 4]]'));

console.log('--- TEST 4: Semicolon format ---');
console.log(parseMatrixFromText('[1 2; 3 4]'));

console.log('--- TEST 5: Multiline OCR Stitching ---');
const ocrLines = [
  'Question 1: Solve the following matrix',
  '[ 1  2 ]',
  '[ 3  4 ]',
  'Question 2: Determinant',
  '| 5  6 |',
  '| 7  8 |'
];
console.log(stitchMatrixLines(ocrLines));

// Matrix sentence extraction test
function extractMatrixFromSentence(sentence) {
  const parsed = parseMatrixFromText(sentence);
  if (!parsed) return null;

  const matStr = `[${parsed.matrix.map(r => `[${r.join(', ')}]`).join(', ')}]`;
  const lower = sentence.toLowerCase();

  // Check if there are two matrices with an operator between them: A + B, A - B, A * B
  const multiMatrixMatch = sentence.match(/(\[\[[\s\S]*?\]\])\s*([\+\-\*])\s*(\[\[[\s\S]*?\]\])/);
  if (multiMatrixMatch) {
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

console.log('--- TEST 6: Sentence Matrix Extraction ---');
console.log(extractMatrixFromSentence('Find the determinant of [[1, 2], [3, 4]]'));
console.log(extractMatrixFromSentence('Calculate inverse of [[4, 7], [2, 6]]'));
console.log(extractMatrixFromSentence('Find eigenvalues of [4 1; 2 3]'));
console.log(extractMatrixFromSentence('Compute [[1, 2], [3, 4]] + [[5, 6], [7, 8]]'));
console.log(extractMatrixFromSentence('Given matrix A = [[2, 0], [1, 3]]'));
console.log(extractMatrixFromSentence('\\begin{vmatrix} 3 & 1 \\\\ 2 & 4 \\end{vmatrix}'));
