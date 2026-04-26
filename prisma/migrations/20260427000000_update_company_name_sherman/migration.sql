-- Migration: Update demo company name to real company
-- Date: 2026-04-27
UPDATE companies
SET
  "razonSocial" = 'SHERMAN S.A.C.',
  "nombreComercial" = 'Sherman',
  "updatedAt" = NOW()
WHERE ruc = '20610169849'
  AND ("razonSocial" = 'CORPORACIÓN ANDINA S.A.C.' OR "nombreComercial" = 'CorpAndina');
