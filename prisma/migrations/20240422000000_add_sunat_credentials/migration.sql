-- CreateTable
CREATE TABLE "sunat_credentials" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "lastTestMessage" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sunat_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sunat_credentials_companyId_key" ON "sunat_credentials"("companyId");

-- CreateIndex
CREATE INDEX "sunat_credentials_companyId_idx" ON "sunat_credentials"("companyId");

-- AddForeignKey
ALTER TABLE "sunat_credentials" ADD CONSTRAINT "sunat_credentials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
