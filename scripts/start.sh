#!/bin/sh
set -e
echo "PORT=${PORT}"
npx prisma migrate resolve --rolled-back 20240421000000_initial_schema 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20240422000000_add_sunat_credentials 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260421000000_add_sync_executions 2>/dev/null || true
npx prisma migrate deploy
npx tsx prisma/seed.deploy.ts
echo "Starting Next.js on PORT=${PORT}"
exec npm run start
