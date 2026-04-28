import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString: "postgresql://postgres:MktSwAjgHgDzHWezLHjnWqaOTKPDNANV@shinkansen.proxy.rlwy.net:21993/railway",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("✅ Conectado a Railway PostgreSQL\n");

async function run(label, sql) {
  try {
    const res = await client.query(sql);
    console.log(`✅ ${label}`);
    if (res.rows?.length) res.rows.forEach(r => console.log("   ", JSON.stringify(r)));
    return true;
  } catch (e) {
    if (e.message.match(/already exists|duplicate/i)) {
      console.log(`⏭️  Ya existe: ${label}`);
      return true;
    }
    console.error(`❌ ${label}: ${e.message}`);
    return false;
  }
}

// 1. download_jobs - nuevas columnas
await run("download_jobs: ADD numTicket",    `ALTER TABLE "download_jobs" ADD COLUMN IF NOT EXISTS "numTicket" TEXT`);
await run("download_jobs: ADD periodo",      `ALTER TABLE "download_jobs" ADD COLUMN IF NOT EXISTS "periodo" TEXT`);
await run("download_jobs: ADD errorMessage", `ALTER TABLE "download_jobs" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT`);
await run("download_jobs: ADD progress",     `ALTER TABLE "download_jobs" ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0`);
await run("download_jobs: ADD resultData",   `ALTER TABLE "download_jobs" ADD COLUMN IF NOT EXISTS "resultData" JSONB`);
await run("download_jobs: ADD status",       `ALTER TABLE "download_jobs" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING'`);

// Rellenar datos existentes antes de hacer NOT NULL
await run("download_jobs: fill numTicket",   `UPDATE "download_jobs" SET "numTicket" = 'LEGACY-' || id WHERE "numTicket" IS NULL`);
await run("download_jobs: fill periodo",     `UPDATE "download_jobs" SET "periodo" = '202501' WHERE "periodo" IS NULL`);
await run("download_jobs: NOT NULL numTicket", `ALTER TABLE "download_jobs" ALTER COLUMN "numTicket" SET NOT NULL`);
await run("download_jobs: NOT NULL periodo",   `ALTER TABLE "download_jobs" ALTER COLUMN "periodo" SET NOT NULL`);

// 2. sunat_credentials - nuevas columnas
await run("sunat_credentials: ADD claveSol",     `ALTER TABLE "sunat_credentials" ADD COLUMN IF NOT EXISTS "claveSol" TEXT NOT NULL DEFAULT ''`);
await run("sunat_credentials: ADD clientSecret", `ALTER TABLE "sunat_credentials" ADD COLUMN IF NOT EXISTS "clientSecret" TEXT NOT NULL DEFAULT ''`);
await run("sunat_credentials: ADD usuario",      `ALTER TABLE "sunat_credentials" ADD COLUMN IF NOT EXISTS "usuario" TEXT NOT NULL DEFAULT ''`);

// 3. vouchers - nuevas columnas
await run("vouchers: ADD direccion",    `ALTER TABLE "vouchers" ADD COLUMN IF NOT EXISTS "direccion" TEXT`);
await run("vouchers: ADD downloadJobId",`ALTER TABLE "vouchers" ADD COLUMN IF NOT EXISTS "downloadJobId" TEXT`);
await run("vouchers: createdById nullable", `ALTER TABLE "vouchers" ALTER COLUMN "createdById" DROP NOT NULL`);

// 4. voucher_documents - nueva columna
await run("voucher_documents: ADD downloadJobId", `ALTER TABLE "voucher_documents" ADD COLUMN IF NOT EXISTS "downloadJobId" TEXT`);

// 5. Crear tablas puente
await run("CREATE download_job_vouchers", `
  CREATE TABLE IF NOT EXISTS "download_job_vouchers" (
    "id" TEXT NOT NULL,
    "downloadJobId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "wasNew" BOOLEAN NOT NULL DEFAULT false,
    "dataChanged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "download_job_vouchers_pkey" PRIMARY KEY ("id")
  )
`);

await run("CREATE download_job_documents", `
  CREATE TABLE IF NOT EXISTS "download_job_documents" (
    "id" TEXT NOT NULL,
    "downloadJobId" TEXT NOT NULL,
    "voucherDocumentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "download_job_documents_pkey" PRIMARY KEY ("id")
  )
`);

// 6. Índices
await run("IDX download_job_vouchers_downloadJobId", `CREATE INDEX IF NOT EXISTS "download_job_vouchers_downloadJobId_idx" ON "download_job_vouchers"("downloadJobId")`);
await run("IDX download_job_vouchers_voucherId",     `CREATE INDEX IF NOT EXISTS "download_job_vouchers_voucherId_idx" ON "download_job_vouchers"("voucherId")`);
await run("IDX download_job_vouchers_createdAt",     `CREATE INDEX IF NOT EXISTS "download_job_vouchers_createdAt_idx" ON "download_job_vouchers"("createdAt")`);
await run("IDX download_job_vouchers_wasNew",        `CREATE INDEX IF NOT EXISTS "download_job_vouchers_wasNew_idx" ON "download_job_vouchers"("wasNew")`);
await run("UNIQ download_job_vouchers",              `CREATE UNIQUE INDEX IF NOT EXISTS "download_job_vouchers_downloadJobId_voucherId_key" ON "download_job_vouchers"("downloadJobId", "voucherId")`);
await run("IDX download_job_documents_downloadJobId",    `CREATE INDEX IF NOT EXISTS "download_job_documents_downloadJobId_idx" ON "download_job_documents"("downloadJobId")`);
await run("IDX download_job_documents_voucherDocumentId",`CREATE INDEX IF NOT EXISTS "download_job_documents_voucherDocumentId_idx" ON "download_job_documents"("voucherDocumentId")`);
await run("UNIQ download_job_documents",                 `CREATE UNIQUE INDEX IF NOT EXISTS "download_job_documents_downloadJobId_voucherDocumentId_key" ON "download_job_documents"("downloadJobId", "voucherDocumentId")`);
await run("IDX download_jobs_status",    `CREATE INDEX IF NOT EXISTS "download_jobs_status_idx" ON "download_jobs"("status")`);
await run("IDX download_jobs_numTicket", `CREATE INDEX IF NOT EXISTS "download_jobs_numTicket_idx" ON "download_jobs"("numTicket")`);
await run("IDX voucher_documents_downloadJobId", `CREATE INDEX IF NOT EXISTS "voucher_documents_downloadJobId_idx" ON "voucher_documents"("downloadJobId")`);
await run("UNIQ voucher_documents_voucherId_tipo", `CREATE UNIQUE INDEX IF NOT EXISTS "voucher_documents_voucherId_tipo_key" ON "voucher_documents"("voucherId", "tipo")`);
await run("IDX vouchers_downloadJobId", `CREATE INDEX IF NOT EXISTS "vouchers_downloadJobId_idx" ON "vouchers"("downloadJobId")`);
await run("IDX vouchers_direccion",     `CREATE INDEX IF NOT EXISTS "vouchers_direccion_idx" ON "vouchers"("direccion")`);
await run("UNIQ vouchers_companyId_tipo_serie_numero", `CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_companyId_tipo_serie_numero_key" ON "vouchers"("companyId", "tipo", "serie", "numero")`);

// 7. Foreign keys
await run("FK vouchers_downloadJobId", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vouchers_downloadJobId_fkey') THEN
      ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_downloadJobId_fkey"
        FOREIGN KEY ("downloadJobId") REFERENCES "download_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$
`);
await run("FK voucher_documents_downloadJobId", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voucher_documents_downloadJobId_fkey') THEN
      ALTER TABLE "voucher_documents" ADD CONSTRAINT "voucher_documents_downloadJobId_fkey"
        FOREIGN KEY ("downloadJobId") REFERENCES "download_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
  END $$
`);
await run("FK download_job_vouchers_downloadJobId", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'download_job_vouchers_downloadJobId_fkey') THEN
      ALTER TABLE "download_job_vouchers" ADD CONSTRAINT "download_job_vouchers_downloadJobId_fkey"
        FOREIGN KEY ("downloadJobId") REFERENCES "download_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$
`);
await run("FK download_job_vouchers_voucherId", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'download_job_vouchers_voucherId_fkey') THEN
      ALTER TABLE "download_job_vouchers" ADD CONSTRAINT "download_job_vouchers_voucherId_fkey"
        FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$
`);
await run("FK download_job_documents_downloadJobId", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'download_job_documents_downloadJobId_fkey') THEN
      ALTER TABLE "download_job_documents" ADD CONSTRAINT "download_job_documents_downloadJobId_fkey"
        FOREIGN KEY ("downloadJobId") REFERENCES "download_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$
`);
await run("FK download_job_documents_voucherDocumentId", `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'download_job_documents_voucherDocumentId_fkey') THEN
      ALTER TABLE "download_job_documents" ADD CONSTRAINT "download_job_documents_voucherDocumentId_fkey"
        FOREIGN KEY ("voucherDocumentId") REFERENCES "voucher_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END $$
`);

// 8. Verificación final
console.log("\n📊 Verificación final:");
const tables = await client.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name IN ('download_job_vouchers','download_job_documents','download_jobs','vouchers','voucher_documents','sunat_credentials')
  ORDER BY table_name
`);
tables.rows.forEach(r => console.log(`  ✅ Tabla: ${r.table_name}`));

const cols = await client.query(`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = 'public'
  AND (
    (table_name = 'download_jobs' AND column_name IN ('numTicket','periodo','status','progress','resultData','errorMessage'))
    OR (table_name = 'vouchers' AND column_name IN ('downloadJobId','direccion'))
    OR (table_name = 'voucher_documents' AND column_name = 'downloadJobId')
    OR (table_name = 'sunat_credentials' AND column_name IN ('clientSecret','claveSol','usuario'))
  )
  ORDER BY table_name, column_name
`);
cols.rows.forEach(r => console.log(`  ✅ Columna: ${r.table_name}.${r.column_name}`));

await client.end();
console.log("\n🎉 Migración completada");
