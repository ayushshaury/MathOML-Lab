/**
 * Geometry engine: 2D shapes, 3D solids, coordinate geometry — with formulas.
 */
import { fmt, texNum, type Solution } from "./core";

interface ShapeDef {
  key: string;
  name: string;
  inputs: string[];
  compute: (v: Record<string, number>) => { results: { label: string; value: number }[]; steps: Solution["steps"]; tex?: string };
}

export const SHAPES: ShapeDef[] = [
  {
    key: "circle",
    name: "Circle",
    inputs: ["r (radius)"],
    compute: ({ r }) => {
      const area = Math.PI * r * r;
      const circ = 2 * Math.PI * r;
      return {
        results: [
          { label: "Area", value: area },
          { label: "Circumference", value: circ },
          { label: "Diameter", value: 2 * r },
        ],
        steps: [
          { title: "Circle formulas", explanation: "π relates every circle's circumference to its diameter.", math: "A = \\pi r^2,\\qquad C = 2\\pi r" },
          { title: "Substitute r", math: `A = \\pi\\cdot(${texNum(r)})^2 = ${fmt(area)},\\qquad C = 2\\pi\\cdot${texNum(r)} = ${fmt(circ)}` },
        ],
        tex: `A = \\pi r^2 = ${fmt(area)}`,
      };
    },
  },
  {
    key: "triangle",
    name: "Triangle (base & height)",
    inputs: ["b (base)", "h (height)"],
    compute: ({ b, h }) => {
      const area = 0.5 * b * h;
      return {
        results: [{ label: "Area", value: area }],
        steps: [
          { title: "Triangle area formula", explanation: "A triangle is exactly half of the parallelogram with the same base and height.", math: "A = \\tfrac{1}{2}\\,b\\,h" },
          { title: "Substitute", math: `A = \\tfrac{1}{2}\\cdot${texNum(b)}\\cdot${texNum(h)} = ${fmt(area)}` },
        ],
        tex: `A = ${fmt(area)}`,
      };
    },
  },
  {
    key: "heron",
    name: "Triangle (three sides — Heron)",
    inputs: ["a", "b", "c"],
    compute: ({ a, b, c }) => {
      if (a + b <= c || a + c <= b || b + c <= a) throw new Error("These three lengths cannot form a triangle (triangle inequality fails).");
      const s = (a + b + c) / 2;
      const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
      return {
        results: [{ label: "Area", value: area }, { label: "Semi-perimeter s", value: s }, { label: "Perimeter", value: a + b + c }],
        steps: [
          { title: "Heron's formula", explanation: "The area from the three sides alone — no height needed.", math: "s = \\tfrac{a+b+c}{2},\\qquad A = \\sqrt{s(s-a)(s-b)(s-c)}" },
          { title: "Semi-perimeter", math: `s = \\frac{${texNum(a)}+${texNum(b)}+${texNum(c)}}{2} = ${fmt(s)}` },
          { title: "Substitute into Heron's formula", math: `A = \\sqrt{${fmt(s)}\\cdot${fmt(s - a)}\\cdot${fmt(s - b)}\\cdot${fmt(s - c)}} = ${fmt(area)}` },
        ],
        tex: `A = ${fmt(area)}`,
      };
    },
  },
  {
    key: "rectangle",
    name: "Rectangle",
    inputs: ["w (width)", "h (height)"],
    compute: ({ w, h }) => ({
      results: [
        { label: "Area", value: w * h },
        { label: "Perimeter", value: 2 * (w + h) },
        { label: "Diagonal", value: Math.sqrt(w * w + h * h) },
      ],
      steps: [
        { title: "Rectangle formulas", math: "A = w\\,h,\\qquad P = 2(w+h),\\qquad d = \\sqrt{w^2+h^2}" },
        { title: "Substitute", math: `A = ${texNum(w)}\\cdot${texNum(h)} = ${fmt(w * h)},\\quad P = ${fmt(2 * (w + h))},\\quad d = ${fmt(Math.sqrt(w * w + h * h))}` },
      ],
      tex: `A = ${fmt(w * h)}`,
    }),
  },
  {
    key: "trapezoid",
    name: "Trapezoid",
    inputs: ["a (top)", "b (bottom)", "h (height)"],
    compute: ({ a, b, h }) => {
      const area = ((a + b) / 2) * h;
      return {
        results: [{ label: "Area", value: area }],
        steps: [
          { title: "Trapezoid area formula", explanation: "Average the two parallel sides, then multiply by the distance between them.", math: "A = \\tfrac{1}{2}(a+b)\\,h" },
          { title: "Substitute", math: `A = \\tfrac{1}{2}(${texNum(a)}+${texNum(b)})\\cdot${texNum(h)} = ${fmt(area)}` },
        ],
        tex: `A = ${fmt(area)}`,
      };
    },
  },
  {
    key: "polygon",
    name: "Regular polygon",
    inputs: ["n (sides)", "s (side length)"],
    compute: ({ n, s }) => {
      if (n < 3) throw new Error("A polygon needs at least 3 sides.");
      const area = (n * s * s) / (4 * Math.tan(Math.PI / n));
      const peri = n * s;
      const angle = ((n - 2) * 180) / n;
      return {
        results: [
          { label: "Area", value: area },
          { label: "Perimeter", value: peri },
          { label: "Interior angle (°)", value: angle },
        ],
        steps: [
          { title: "Regular polygon formulas", explanation: "Split the polygon into n identical triangles from the centre.", math: "A = \\frac{n\\,s^2}{4\\tan(\\pi/n)},\\qquad \\theta_{int} = \\frac{(n-2)\\cdot180^\\circ}{n}" },
          { title: "Substitute", math: `A = \\frac{${n}\\cdot(${texNum(s)})^2}{4\\tan(\\pi/${n})} = ${fmt(area)},\\qquad \\theta = ${fmt(angle)}^\\circ` },
        ],
        tex: `A = ${fmt(area)}`,
      };
    },
  },
  {
    key: "sphere",
    name: "Sphere",
    inputs: ["r (radius)"],
    compute: ({ r }) => {
      const vol = (4 / 3) * Math.PI * r ** 3;
      const sa = 4 * Math.PI * r * r;
      return {
        results: [{ label: "Volume", value: vol }, { label: "Surface area", value: sa }],
        steps: [
          { title: "Sphere formulas", math: "V = \\tfrac{4}{3}\\pi r^3,\\qquad A = 4\\pi r^2" },
          { title: "Substitute", math: `V = \\tfrac{4}{3}\\pi(${texNum(r)})^3 = ${fmt(vol)},\\qquad A = 4\\pi(${texNum(r)})^2 = ${fmt(sa)}` },
        ],
        tex: `V = ${fmt(vol)}`,
      };
    },
  },
  {
    key: "cylinder",
    name: "Cylinder",
    inputs: ["r (radius)", "h (height)"],
    compute: ({ r, h }) => {
      const vol = Math.PI * r * r * h;
      const sa = 2 * Math.PI * r * r + 2 * Math.PI * r * h;
      return {
        results: [{ label: "Volume", value: vol }, { label: "Total surface area", value: sa }, { label: "Lateral surface", value: 2 * Math.PI * r * h }],
        steps: [
          { title: "Cylinder formulas", explanation: "A cylinder is a circle swept along a height: volume = base × height.", math: "V = \\pi r^2 h,\\qquad A = 2\\pi r^2 + 2\\pi r h" },
          { title: "Substitute", math: `V = \\pi(${texNum(r)})^2\\cdot${texNum(h)} = ${fmt(vol)}` },
        ],
        tex: `V = ${fmt(vol)}`,
      };
    },
  },
  {
    key: "cone",
    name: "Cone",
    inputs: ["r (radius)", "h (height)"],
    compute: ({ r, h }) => {
      const vol = (Math.PI * r * r * h) / 3;
      const l = Math.sqrt(r * r + h * h);
      const sa = Math.PI * r * r + Math.PI * r * l;
      return {
        results: [{ label: "Volume", value: vol }, { label: "Slant height", value: l }, { label: "Surface area", value: sa }],
        steps: [
          { title: "Cone formulas", explanation: "A cone is one third of the cylinder with the same base and height; the slant height comes from Pythagoras.", math: "V = \\tfrac{1}{3}\\pi r^2 h,\\qquad l = \\sqrt{r^2+h^2},\\qquad A = \\pi r^2 + \\pi r l" },
          { title: "Substitute", math: `V = \\tfrac{1}{3}\\pi(${texNum(r)})^2\\cdot${texNum(h)} = ${fmt(vol)},\\qquad l = ${fmt(l)}` },
        ],
        tex: `V = ${fmt(vol)}`,
      };
    },
  },
  {
    key: "box",
    name: "Box (rectangular prism)",
    inputs: ["a", "b", "c"],
    compute: ({ a, b, c }) => {
      const vol = a * b * c;
      const sa = 2 * (a * b + b * c + a * c);
      const diag = Math.sqrt(a * a + b * b + c * c);
      return {
        results: [{ label: "Volume", value: vol }, { label: "Surface area", value: sa }, { label: "Space diagonal", value: diag }],
        steps: [
          { title: "Box formulas", math: "V = a\\,b\\,c,\\qquad A = 2(ab+bc+ac),\\qquad d = \\sqrt{a^2+b^2+c^2}" },
          { title: "Substitute", math: `V = ${texNum(a)}\\cdot${texNum(b)}\\cdot${texNum(c)} = ${fmt(vol)}` },
        ],
        tex: `V = ${fmt(vol)}`,
      };
    },
  },
  {
    key: "pyramid",
    name: "Square pyramid",
    inputs: ["a (base edge)", "h (height)"],
    compute: ({ a, h }) => {
      const vol = (a * a * h) / 3;
      const l = Math.sqrt(h * h + (a / 2) ** 2);
      const sa = a * a + 2 * a * l;
      return {
        results: [{ label: "Volume", value: vol }, { label: "Slant height", value: l }, { label: "Surface area", value: sa }],
        steps: [
          { title: "Pyramid formulas", math: "V = \\tfrac{1}{3}a^2 h,\\qquad l = \\sqrt{h^2 + (a/2)^2}" },
          { title: "Substitute", math: `V = \\tfrac{1}{3}(${texNum(a)})^2\\cdot${texNum(h)} = ${fmt(vol)}` },
        ],
        tex: `V = ${fmt(vol)}`,
      };
    },
  },
];

export function shapeSolution(shapeKey: string, values: Record<string, number>): Solution {
  const shape = SHAPES.find((s) => s.key === shapeKey);
  if (!shape) return { title: "Geometry", steps: [], error: "Unknown shape." };
  try {
    for (const [k, v] of Object.entries(values)) {
      if (!Number.isFinite(v)) throw new Error(`Value "${k}" is not a valid number.`);
      if (v <= 0) throw new Error(`Value "${k}" must be positive.`);
    }
    const out = shape.compute(values);
    const resTex = out.results.map((r) => `${r.label} = ${fmt(r.value)}`).join(",\\quad ");
    return {
      title: shape.name,
      resultTex: out.tex ?? resTex,
      resultText: out.results.map((r) => `${r.label}=${fmt(r.value)}`).join(", "),
      steps: out.steps,
    };
  } catch (e) {
    return { title: shape.name, steps: [], error: (e as Error).message };
  }
}

/** Coordinate geometry: distance, midpoint, slope, line equation. */
export function coordinateGeometry(x1: number, y1: number, x2: number, y2: number): Solution {
  const steps: Solution["steps"] = [];
  try {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    const slope = Math.abs(dx) < 1e-12 ? Infinity : dy / dx;
    steps.push({ title: "The two points", math: `P_1(${texNum(x1)},\\,${texNum(y1)}),\\qquad P_2(${texNum(x2)},\\,${texNum(y2)})` });
    steps.push({
      title: "Distance (Pythagorean theorem)",
      explanation: "The distance is the hypotenuse of the right triangle with legs Δx and Δy.",
      math: `d = \\sqrt{(x_2-x_1)^2 + (y_2-y_1)^2} = \\sqrt{(${texNum(x2)}-(${texNum(x1)}))^2 + (${texNum(y2)}-(${texNum(y1)}))^2} = ${fmt(dist)}`,
    });
    steps.push({
      title: "Midpoint (average of coordinates)",
      math: `M = \\left(\\frac{x_1+x_2}{2},\\; \\frac{y_1+y_2}{2}\\right) = (${fmt(mid.x)},\\; ${fmt(mid.y)})`,
    });
    steps.push({
      title: "Slope (rise over run)",
      math: Number.isFinite(slope)
        ? `m = \\frac{y_2 - y_1}{x_2 - x_1} = \\frac{${texNum(dy)}}{${texNum(dx)}} = ${fmt(slope)}`
        : "m = \\infty\\ \\text{(vertical line)}",
    });
    if (Number.isFinite(slope)) {
      const b = y1 - slope * x1;
      steps.push({
        title: "Line through both points (slope-intercept form)",
        math: `y = m\\,x + b \\;\\Rightarrow\\; y = ${fmt(slope)}\\,x ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}`,
      });
      return {
        title: "Coordinate Geometry",
        resultTex: `d = ${fmt(dist)},\\; M(${fmt(mid.x)}, ${fmt(mid.y)}),\\; m = ${fmt(slope)},\\; y = ${fmt(slope)}x ${b >= 0 ? "+" : "-"} ${fmt(Math.abs(b))}`,
        resultText: `d=${fmt(dist)}, midpoint=(${fmt(mid.x)}, ${fmt(mid.y)}), slope=${fmt(slope)}, y=${fmt(slope)}x+(${fmt(b)})`,
        steps,
        plot: {
          curves: [{ label: "line", expr: `${slope}*x + (${b})` }],
          points: [
            { x: x1, y: y1, label: `P1(${fmt(x1)}, ${fmt(y1)})` },
            { x: x2, y: y2, label: `P2(${fmt(x2)}, ${fmt(y2)})` },
          ],
        },
      };
    }
    return {
      title: "Coordinate Geometry",
      resultTex: `d = ${fmt(dist)},\\; M(${fmt(mid.x)}, ${fmt(mid.y)}),\\; m = \\infty`,
      resultText: `d=${fmt(dist)}, midpoint=(${fmt(mid.x)}, ${fmt(mid.y)})`,
      steps,
      plot: { points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] },
    };
  } catch (e) {
    return { title: "Coordinate Geometry", steps: [], error: (e as Error).message };
  }
}
