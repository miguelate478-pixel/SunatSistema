#!/bin/sh
# ControlSUNAT startup script v4
set -e

echo "=== ControlSUNAT Startup ==="
echo "PORT is: ${PORT}"

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
# Railway sets PORT automatically - Next.js reads it natively
# Do NOT override PORT - let Railway control it
echo "Step 4: Starting server on port ${PORT}..."
exec npm run start
