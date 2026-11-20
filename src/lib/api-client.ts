/**
 * Production API Client for Vercel Frontend -> Render Backend communication.
 */

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") || "";

export function getApiEndpoint(endpoint: string): string {
  const clean = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  if (!BACKEND_URL) {
    return clean;
  }
  return `${BACKEND_URL}${clean}`;
}

export async function checkBackendHealth(): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const url = getApiEndpoint("/api/health");
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
