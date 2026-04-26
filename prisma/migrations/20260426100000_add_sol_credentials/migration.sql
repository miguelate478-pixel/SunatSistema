-- Migration: Add usuario_sol and clave_sol_enc to sunat_credentials
-- Date: 2026-04-26
-- Reason: SUNAT CPE API uses grant_type=password with usuario SOL + clave SOL,
--         not client_credentials. These fields are required for OAuth token.

ALTER TABLE sunat_credentials
  ADD COLUMN IF NOT EXISTS "usuarioSol" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "claveSolEnc" TEXT NOT NULL DEFAULT '';
