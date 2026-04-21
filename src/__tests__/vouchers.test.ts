import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";
const DEMO_EMAIL = "carlos.mendoza@corpandina.com";
const DEMO_PASSWORD = "password123";

async function getAuthCookie(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  const cookie = res.headers.get("set-cookie") ?? "";
  const match = cookie.match(/auth-token=([^;]+)/);
  return match ? `auth-token=${match[1]}` : "";
}

const canRun = async () => {
  try { await fetch(`${BASE}/api/auth/me`, { signal: AbortSignal.timeout(2000) }); return true; }
  catch { return false; }
};

describe("GET /api/vouchers", () => {
  it("returns 401 without auth", async () => {
    if (!await canRun()) return;
    const res = await fetch(`${BASE}/api/vouchers?companyId=00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(401);
  });

  it("returns vouchers list with auth", async () => {
    if (!await canRun()) return;
    const cookie = await getAuthCookie();
    if (!cookie) return;

    // Get companyId from session
    const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } });
    const me = await meRes.json();
    const companyId = me.user?.companyRoles?.[0]?.companyId;
    if (!companyId) return;

    const res = await fetch(`${BASE}/api/vouchers?companyId=${companyId}&tipo=COMPRA`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
});

describe("GET /api/dashboard/summary", () => {
  it("returns summary data with auth", async () => {
    if (!await canRun()) return;
    const cookie = await getAuthCookie();
    if (!cookie) return;

    const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } });
    const me = await meRes.json();
    const companyId = me.user?.companyRoles?.[0]?.companyId;
    if (!companyId) return;

    const res = await fetch(`${BASE}/api/dashboard/summary?companyId=${companyId}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(typeof json.data.comprasMes).toBe("number");
    expect(typeof json.data.ventasMes).toBe("number");
  });
});

describe("GET /api/detracciones", () => {
  it("returns detracciones with auth", async () => {
    if (!await canRun()) return;
    const cookie = await getAuthCookie();
    if (!cookie) return;

    const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } });
    const me = await meRes.json();
    const companyId = me.user?.companyRoles?.[0]?.companyId;
    if (!companyId) return;

    const res = await fetch(`${BASE}/api/detracciones?companyId=${companyId}`, {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
});

describe("POST /api/download-jobs", () => {
  it("creates a download job with auth", async () => {
    if (!await canRun()) return;
    const cookie = await getAuthCookie();
    if (!cookie) return;

    const meRes = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } });
    const me = await meRes.json();
    const companyId = me.user?.companyRoles?.[0]?.companyId;
    if (!companyId) return;

    const res = await fetch(`${BASE}/api/download-jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ companyId, tipo: "XML", parametros: {} }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.estado).toBe("PENDING");
  });
});
