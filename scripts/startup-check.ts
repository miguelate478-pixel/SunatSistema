/**
 * Startup validation script
 * Verifica que todas las variables de entorno críticas estén configuradas
 * antes de arrancar el servidor.
 *
 * Uso: npx tsx scripts/startup-check.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env manually (tsx doesn't auto-load dotenv)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

interface EnvCheck {
  key: string;
  required: boolean;
  condition?: () => boolean;
  description: string;
}

const checks: EnvCheck[] = [
  { key: "DATABASE_URL",        required: true,  description: "PostgreSQL connection string" },
  { key: "JWT_SECRET",          required: true,  description: "JWT signing secret (min 32 chars)" },
  { key: "NEXTAUTH_URL",        required: true,  description: "App base URL (must be HTTPS in production)" },
  { key: "STORAGE_PROVIDER",    required: false, description: "Storage provider: local | s3" },
  { key: "S3_BUCKET",           required: false, condition: () => process.env.STORAGE_PROVIDER === "s3", description: "S3/R2 bucket name" },
  { key: "S3_ACCESS_KEY_ID",    required: false, condition: () => process.env.STORAGE_PROVIDER === "s3", description: "S3/R2 access key" },
  { key: "S3_SECRET_ACCESS_KEY",required: false, condition: () => process.env.STORAGE_PROVIDER === "s3", description: "S3/R2 secret key" },
  { key: "SUNAT_ENCRYPTION_KEY",required: false, condition: () => process.env.SUNAT_PROVIDER === "real", description: "SUNAT credential encryption key (64 hex chars)" },
  { key: "REDIS_URL",           required: false, description: "Redis URL (optional — enables BullMQ)" },
];

let hasErrors = false;

console.log("\n🔍 ControlSUNAT — Startup Environment Check\n");

for (const check of checks) {
  const isRequired = check.required || (check.condition?.() ?? false);
  const value = process.env[check.key];
  const present = !!value;

  if (isRequired && !present) {
    console.error(`  ✗ MISSING  ${check.key.padEnd(25)} — ${check.description}`);
    hasErrors = true;
  } else if (present) {
    // Validate specific formats
    if (check.key === "JWT_SECRET" && value!.length < 32) {
      console.error(`  ✗ TOO_SHORT ${check.key.padEnd(24)} — debe tener al menos 32 caracteres`);
      hasErrors = true;
    } else if (check.key === "SUNAT_ENCRYPTION_KEY" && value!.length !== 64) {
      console.error(`  ✗ INVALID  ${check.key.padEnd(25)} — debe tener exactamente 64 caracteres hex`);
      hasErrors = true;
    } else if (check.key === "NEXTAUTH_URL" && process.env.NODE_ENV === "production" && !value!.startsWith("https://")) {
      console.warn(`  ⚠ INSECURE ${check.key.padEnd(25)} — debe usar HTTPS en producción`);
    } else {
      const display = ["JWT_SECRET", "S3_SECRET_ACCESS_KEY", "SUNAT_ENCRYPTION_KEY", "REDIS_URL"].includes(check.key)
        ? "***"
        : value!.slice(0, 40) + (value!.length > 40 ? "..." : "");
      console.log(`  ✓ OK       ${check.key.padEnd(25)} = ${display}`);
    }
  } else {
    console.log(`  -  OPTIONAL ${check.key.padEnd(24)} — ${check.description}`);
  }
}

console.log("");

if (hasErrors) {
  console.error("✗ Startup check FAILED — configura las variables faltantes antes de arrancar\n");
  process.exit(1);
} else {
  console.log("✓ Startup check PASSED\n");
}
