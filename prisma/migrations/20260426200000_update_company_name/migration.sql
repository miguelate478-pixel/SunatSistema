-- Migration: Update company name from demo to real
-- Date: 2026-04-26

UPDATE companies
SET
  "razonSocial" = 'SHERMAN S.A.C.',
  "nombreComercial" = 'Sherman',
  "updatedAt" = NOW()
WHERE ruc = '20610169849';
