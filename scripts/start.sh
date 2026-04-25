#!/bin/sh
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

# Step 4: Start server
echo "Step 4: Starting server on port ${PORT:-3000}..."
exec npm run start -- -p ${PORT:-3000}
