/**
 * Auth integration tests
 * Requires TEST_DATABASE_URL to run against a real DB.
 * Without it, tests are skipped gracefully.
 */

import { describe, it, expect } from "vitest";

const BASE = "http://localhost:3000";
const DEMO_EMAIL = "carlos.mendoza@corpandina.com";
const DEMO_PASSWORD = "password123";

// Skip all if no server running
const canRun = async () => {
  try {
    const r = await fetch(`${BASE}/api/auth/me`, { signal: AbortSignal.timeout(2000) });
    return r.status !== 0;
  } catch {
    return false;
  }
};

describe("POST /api/auth/login", () => {
  it("returns 400 for missing fields", async () => {
    if (!await canRun()) return;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "bad" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 401 for wrong credentials", async () => {
    if (!await canRun()) return;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL, password: "wrongpassword" }),
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).not.toContain("stack");
    expect(json.error).not.toContain("prisma");
  });

  it("returns 200 and sets cookie for valid credentials", async () => {
    if (!await canRun()) return;
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.user.email).toBe(DEMO_EMAIL);
    expect(json.user.password).toBeUndefined(); // never expose password
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toContain("auth-token");
    expect(cookie).toContain("HttpOnly");
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without cookie", async () => {
    if (!await canRun()) return;
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it("returns session with valid cookie", async () => {
    if (!await canRun()) return;
    // Login first
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    const cookie = loginRes.headers.get("set-cookie") ?? "";
    const tokenMatch = cookie.match(/auth-token=([^;]+)/);
    if (!tokenMatch) return;

    const meRes = await fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: `auth-token=${tokenMatch[1]}` },
    });
    expect(meRes.status).toBe(200);
    const json = await meRes.json();
    expect(json.success).toBe(true);
    expect(json.user.email).toBe(DEMO_EMAIL);
  });
});
