#!/bin/sh
# ControlSUNAT startup script v3
set -e

echo "=== ControlSUNAT Startup ==="

# Step 1: Resolve any failed migrations
echo "Step 1: Resolving failed migrations..."
npx prisma migrate resolve --rolled-back 20240421000000_initial_schema 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20240422000000_add_sunat_credentials 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260421000000_add_sync_executions 2>/dev/null || true

# Step 2: Run migrations
echo "Step 2: Running migrations..."
npx prisma migrate deploy

# Step 3: Seed if empty
echo "Step 3: Seeding if needed..."
npx tsx prisma/seed.deploy.ts

# Step 4: Set PORT and start server
# Next.js reads PORT env var natively - do NOT use -p flag
export PORT=${PORT:-3000}
echo "Step 4: Starting server on port ${PORT}..."
exec npm run start
