-- Migration: Reset sunat_credentials to force re-encryption with current key
-- Date: 2026-04-26
-- Reason: Previous credentials were encrypted with an incorrect key (63 chars instead of 64).
--         Deleting forces the user to re-enter credentials via /configuracion,
--         which will encrypt them correctly with the current SUNAT_ENCRYPTION_KEY.

DELETE FROM sunat_credentials;
