-- CreateTable: sync_executions
CREATE TABLE "sync_executions" (
    "id"          TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "tipo"        TEXT NOT NULL DEFAULT 'DIARIA',
    "estado"      TEXT NOT NULL DEFAULT 'PENDING',
    "periodo"     TEXT,
    "fechaInicio" TEXT,
    "fechaFin"    TEXT,
    "docsNuevos"  INTEGER NOT NULL DEFAULT 0,
    "docsOk"      INTEGER NOT NULL DEFAULT 0,
    "docsError"   INTEGER NOT NULL DEFAULT 0,
    "errorMsg"    TEXT,
    "duracionMs"  INTEGER,
    "triggeredBy" TEXT,
    "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "sync_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_executions_companyId_idx" ON "sync_executions"("companyId");
CREATE INDEX "sync_executions_estado_idx"    ON "sync_executions"("estado");
CREATE INDEX "sync_executions_tipo_idx"      ON "sync_executions"("tipo");
CREATE INDEX "sync_executions_startedAt_idx" ON "sync_executions"("startedAt");

-- AddForeignKey
ALTER TABLE "sync_executions"
    ADD CONSTRAINT "sync_executions_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
