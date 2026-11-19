/**
 * Thin typed wrapper around nerdamer (symbolic CAS) for browser use.
 */
import nerdamer from "nerdamer";

export interface NrdExpr {
  toString(): string;
  toTeX(): string;
  valueOf(): unknown;
  evaluate(): NrdExpr;
}

export function nrd(expr: string): NrdExpr {
  return nerdamer(expr) as unknown as NrdExpr;
}

export function nrdTex(expr: string | NrdExpr): string | null {
  try {
    if (typeof expr === "string") return (nerdamer(expr) as unknown as NrdExpr).toTeX();
    return expr.toTeX();
  } catch {
    return null;
  }
}

export function nrdTry(expr: string): NrdExpr | null {
  try {
    const r = nerdamer(expr) as unknown as NrdExpr;
    const s = r.toString();
    if (!s || s === "undefined") return null;
    return r;
  } catch {
    return null;
  }
}

export default nerdamer;
