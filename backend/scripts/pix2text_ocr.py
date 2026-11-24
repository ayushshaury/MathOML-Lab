#!/usr/bin/env python3
"""
MathOML Pix2Text OCR Engine
High-accuracy formula & multi-format math question detector using Pix2Text.
"""

import sys
import os
import json
import re

# Configure local storage directories before importing any ML libraries
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, ".models")
os.makedirs(MODELS_DIR, exist_ok=True)

os.environ["PIX2TEXT_HOME"] = os.path.join(MODELS_DIR, "pix2text")
os.environ["CNOCR_HOME"] = os.path.join(MODELS_DIR, "cnocr")
os.environ["CNSTD_HOME"] = os.path.join(MODELS_DIR, "cnstd")
os.environ["YOLO_CONFIG_DIR"] = os.path.join(MODELS_DIR, "yolo")
os.environ["HF_HOME"] = os.path.join(MODELS_DIR, "hf")

def detect_problem_type(math_expr: str, raw_text: str) -> str:
    combined = (math_expr + " " + raw_text).lower()
    if re.search(r"\\begin\{(?:pmatrix|bmatrix|matrix|vmatrix|bmatrix)\}|\[\[|\b(?:det|inv|eigen)\(|matrix|determinant|eigenvalue", combined):
        return "matrix"
    if re.search(r"\\int|integrate|integrand|integral|\bdx\b|\bdt\b", combined):
        return "integral"
    if re.search(r"\\frac\{d\}\{dx\}|d/dx|derivative|differentiate|f\'\(", combined):
        return "derivative"
    if "=" in math_expr:
        return "equation"
    return "algebra"

def clean_latex(latex_str: str) -> str:
    if not latex_str:
        return ""
    # Strip delimiters like $$ ... $$ or $ ... $ or \[ ... \]
    s = re.sub(r"^\s*(\$\$|\$|\\\[|\()", "", latex_str)
    s = re.sub(r"(\$\$|\$|\\\]|\))\s*$", "", s)
    return s.strip()

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.isfile(image_path):
        print(json.dumps({"success": False, "error": f"Image file not found: {image_path}"}))
        sys.exit(1)

    try:
        from pix2text import Pix2Text
        p2t = Pix2Text.from_config()
        result = p2t.recognize(image_path)
    except Exception as e:
        # If full document recognition fails, try formula-only mode
        try:
            from pix2text import Pix2Text
            p2t = Pix2Text.from_config()
            result = p2t.recognize_formula(image_path)
        except Exception as e2:
            print(json.dumps({
                "success": False, 
                "error": f"Pix2Text error: {str(e2)}",
                "details": str(e)
            }))
            sys.exit(1)

    raw_text = ""
    latex_items = []

    if isinstance(result, str):
        raw_text = result
        latex_items = [result]
    elif isinstance(result, list):
        for item in result:
            if isinstance(item, dict):
                text_val = item.get("text", "")
                raw_text += text_val + "\n"
                if item.get("type") in ["formula", "isolated"]:
                    latex_items.append(text_val)
            elif isinstance(item, str):
                raw_text += item + "\n"
                latex_items.append(item)
    elif isinstance(result, dict):
        raw_text = result.get("text", "")
        if "items" in result and isinstance(result["items"], list):
            for item in result["items"]:
                if isinstance(item, dict):
                    t = item.get("text", "")
                    if item.get("type") in ["formula", "isolated"]:
                        latex_items.append(t)

    # Extract distinct question items
    questions = []
    lines = [line.strip() for line in raw_text.split("\n") if line.strip()]

    qid = 1
    # Check if lines have question numbers like "1.", "Q1:", "Problem 1"
    for line in lines:
        cleaned = clean_latex(line)
        if len(cleaned) < 2:
            continue
        ptype = detect_problem_type(cleaned, line)
        questions.append({
            "id": qid,
            "raw": line,
            "clean": cleaned,
            "type": ptype,
            "confidence": 0.95
        })
        qid += 1

    if not questions and latex_items:
        for idx, item in enumerate(latex_items, start=1):
            cleaned = clean_latex(item)
            questions.append({
                "id": idx,
                "raw": item,
                "clean": cleaned,
                "type": detect_problem_type(cleaned, item),
                "confidence": 0.95
            })

    output = {
        "success": True,
        "engine": "pix2text",
        "text": raw_text.strip(),
        "questions": questions
    }
    print(json.dumps(output))

if __name__ == "__main__":
    main()
