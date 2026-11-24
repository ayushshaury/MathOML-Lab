import {
  parseAllQuestions,
  extractEquationFromSentence,
  classifyMathQuestion,
  toDisplayTex,
  parseMatrixFromText,
  stitchMatrixLines
} from "../backend/src/ocr";

console.log("=== RUNNING MATRIX OCR VERIFICATION ===");

// Test 1: Multiline OCR rows stitching
const multilineOcr = `
Mathematics Exam
[ 1  2 ]
[ 3  4 ]
Find the determinant of the matrix:
| 5  6 |
| 7  8 |
`;
const q1 = parseAllQuestions(multilineOcr);
console.log("\n[Test 1] Multiline OCR Matrix Result:");
console.log(JSON.stringify(q1, null, 2));

// Test 2: Natural language with matrix instructions
const nlInputs = [
  "Question 1: Find the determinant of [[1, 2], [3, 4]]",
  "Question 2: Compute the inverse of [[4, 7], [2, 6]]",
  "Question 3: Calculate eigenvalues of [4 1; 2 3]",
  "Question 4: Compute [[1, 2], [3, 4]] + [[5, 6], [7, 8]]",
  "Question 5: \\begin{pmatrix} 2 & -1 \\\\ 0 & 3 \\end{pmatrix}",
  "Question 6: \\begin{vmatrix} 3 & 1 \\\\ 2 & 4 \\end{vmatrix}"
];

console.log("\n[Test 2] Sentence Matrix Extraction Results:");
for (const input of nlInputs) {
  const parsed = extractEquationFromSentence(input);
  console.log(`Input: "${input}"`);
  console.log(`Extracted:`, parsed);
}

console.log("\n=== MATRIX OCR VERIFICATION FINISHED SUCCESSFULLY ===");
