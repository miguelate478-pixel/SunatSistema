#!/bin/sh
set -e
echo "PORT=${PORT}"
npx prisma migrate resolve --rolled-back 20240421000000_initial_schema 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20240422000000_add_sunat_credentials 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260421000000_add_sync_executions 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260425000000_update_company_ruc 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260426000000_reset_sunat_credentials 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260426100000_add_sol_credentials 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260426200000_update_company_name 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260427000000_update_company_name_sherman 2>/dev/null || true
npx prisma migrate deploy
npx tsx prisma/seed.deploy.ts
echo "Starting Next.js on PORT=${PORT}"
exec npm run start
