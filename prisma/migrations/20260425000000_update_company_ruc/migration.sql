-- Migration: Update company RUC from demo value to real pilot RUC
-- Date: 2026-04-25
-- Reason: Replace seed/demo RUC 20512345678 with the real company RUC 20610169849

-- Update the company record
UPDATE companies
SET
  ruc = '20610169849',
  updated_at = NOW()
WHERE ruc = '20512345678';

-- Update any vouchers where the company was the receptor (compras)
UPDATE vouchers
SET
  ruc_receptor = '20610169849',
  updated_at = NOW()
WHERE ruc_receptor = '20512345678';

-- Update any vouchers where the company was the emisor (ventas)
UPDATE vouchers
SET
  ruc_emisor = '20610169849',
  updated_at = NOW()
WHERE ruc_emisor = '20512345678';

-- Update sunat_credentials if already configured with old RUC
UPDATE sunat_credentials
SET
  ruc = '20610169849',
  updated_at = NOW()
WHERE ruc = '20512345678';
