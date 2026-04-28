-- ============================================================
-- MIGRACIÓN SEGURA - Solo agrega, no elimina datos existentes
-- ============================================================

-- 1. Agregar columnas nuevas a download_jobs con defaults para datos existentes
ALTER TABLE "download_jobs" 
  ADD COLUMN IF NOT EXISTS "numTicket" TEXT,
  ADD COLUMN IF NOT EXISTS "periodo" TEXT,
  ADD COLUMN IF NOT EXISTS "errorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "resultData" JSONB,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Rellenar datos existentes con valores por defecto
UPDATE "download_jobs" SET "numTicket" = COALESCE("numTicket", 'LEGACY-' || id) WHERE "numTicket" IS NULL;
UPDATE "download_jobs" SET "periodo" = COALESCE("periodo", '202501') WHERE "periodo" IS NULL;

-- Hacer NOT NULL después de rellenar
ALTER TABLE "download_jobs" ALTER COLUMN "numTicket" SET NOT NULL;
ALTER TABLE "download_jobs" ALTER COLUMN "periodo" SET NOT NULL;

-- 2. Agregar columnas nuevas a sunat_credentials con defaults
ALTER TABLE "sunat_credentials"
  ADD COLUMN IF NOT EXISTS "claveSol" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "clientSecret" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "usuario" TEXT NOT NULL DEFAULT '';

-- 3. Agregar columnas nuevas a vouchers
ALTER TABLE "vouchers"
  ADD COLUMN IF NOT EXISTS "direccion" TEXT,
  ADD COLUMN IF NOT EXISTS "downloadJobId" TEXT;

-- Hacer createdById nullable si no lo es
ALTER TABLE "vouchers" ALTER COLUMN "createdById" DROP NOT NULL;

-- 4. Agregar columna nueva a voucher_documents
ALTER TABLE "voucher_documents"
  ADD COLUMN IF NOT EXISTS "downloadJobId" TEXT;

-- 5. Crear tablas puente
CREATE TABLE IF NOT EXISTS "download_job_vouchers" (
    "id" TEXT NOT NULL,
    "downloadJobId" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "wasNew" BOOLEAN NOT NULL DEFAULT false,
    "dataChanged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "download_job_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "download_job_documents" (
    "id" TEXT NOT NULL,
    "downloadJobId" TEXT NOT NULL,
    "voucherDocumentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "download_job_documents_pkey" PRIMARY KEY ("id")
);

-- 6. Crear índices nuevos (IF NOT EXISTS para idempotencia)
CREATE INDEX IF NOT EXISTS "download_job_vouchers_downloadJobId_idx" ON "download_job_vouchers"("downloadJobId");
CREATE INDEX IF NOT EXISTS "download_job_vouchers_voucherId_idx" ON "download_job_vouchers"("voucherId");
CREATE INDEX IF NOT EXISTS "download_job_vouchers_createdAt_idx" ON "download_job_vouchers"("createdAt");
CREATE INDEX IF NOT EXISTS "download_job_vouchers_wasNew_idx" ON "download_job_vouchers"("wasNew");
CREATE UNIQUE INDEX IF NOT EXISTS "download_job_vouchers_downloadJobId_voucherId_key" ON "download_job_vouchers"("downloadJobId", "voucherId");

CREATE INDEX IF NOT EXISTS "download_job_documents_downloadJobId_idx" ON "download_job_documents"("downloadJobId");
CREATE INDEX IF NOT EXISTS "download_job_documents_voucherDocumentId_idx" ON "download_job_documents"("voucherDocumentId");
CREATE UNIQUE INDEX IF NOT EXISTS "download_job_documents_downloadJobId_voucherDocumentId_key" ON "download_job_documents"("downloadJobId", "voucherDocumentId");

CREATE INDEX IF NOT EXISTS "download_jobs_status_idx" ON "download_jobs"("status");
CREATE INDEX IF NOT EXISTS "download_jobs_numTicket_idx" ON "download_jobs"("numTicket");
CREATE INDEX IF NOT EXISTS "voucher_documents_downloadJobId_idx" ON "voucher_documents"("downloadJobId");
CREATE UNIQUE INDEX IF NOT EXISTS "voucher_documents_voucherId_tipo_key" ON "voucher_documents"("voucherId", "tipo");
CREATE INDEX IF NOT EXISTS "vouchers_downloadJobId_idx" ON "vouchers"("downloadJobId");
CREATE INDEX IF NOT EXISTS "vouchers_direccion_idx" ON "vouchers"("direccion");
CREATE UNIQUE INDEX IF NOT EXISTS "vouchers_companyId_tipo_serie_numero_key" ON "vouchers"("companyId", "tipo", "serie", "numero");

-- 7. Agregar foreign keys (solo si no existen)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vouchers_downloadJobId_fkey') THEN
    ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_downloadJobId_fkey"
      FOREIGN KEY ("downloadJobId") REFERENCES "download_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voucher_documents_downloadJobId_fkey') THEN
    ALTER TABLE "voucher_documents" ADD CONSTRAINT "voucher_documents_downloadJobId_fkey"
      FOREIGN KEY ("downloadJobId") REFERENCES "download_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'download_job_vouchers_downloadJobId_fkey') THEN
    ALTER TABLE "download_job_vouchers" ADD CONSTRAINT "download_job_vouchers_downloadJobId_fkey"
      FOREIGN KEY ("downloadJobId") REFERENCES "download_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'download_job_vouchers_voucherId_fkey') THEN
    ALTER TABLE "download_job_vouchers" ADD CONSTRAINT "download_job_vouchers_voucherId_fkey"
      FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'download_job_documents_downloadJobId_fkey') THEN
    ALTER TABLE "download_job_documents" ADD CONSTRAINT "download_job_documents_downloadJobId_fkey"
      FOREIGN KEY ("downloadJobId") REFERENCES "download_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'download_job_documents_voucherDocumentId_fkey') THEN
    ALTER TABLE "download_job_documents" ADD CONSTRAINT "download_job_documents_voucherDocumentId_fkey"
      FOREIGN KEY ("voucherDocumentId") REFERENCES "voucher_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Verificar resultado
SELECT 
  'download_job_vouchers' as tabla, COUNT(*) as filas FROM "download_job_vouchers"
UNION ALL
SELECT 
  'download_job_documents', COUNT(*) FROM "download_job_documents"
UNION ALL
SELECT 
  'download_jobs columns', COUNT(*) FROM information_schema.columns 
  WHERE table_name = 'download_jobs' AND column_name IN ('numTicket','periodo','status','progress');
