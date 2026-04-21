#!/usr/bin/env bash
# ============================================================
# ControlSUNAT — Deploy Script
# Uso: bash scripts/deploy.sh [staging|production]
# ============================================================
set -euo pipefail

ENV="${1:-staging}"
echo "▶ Deploy: $ENV"

# 1. Verificar variables de entorno críticas
required_vars=(DATABASE_URL JWT_SECRET NEXTAUTH_URL STORAGE_PROVIDER SUNAT_ENCRYPTION_KEY)
for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "✗ Variable requerida no configurada: $var"
    exit 1
  fi
done
echo "✓ Variables de entorno verificadas"

# 2. Instalar dependencias
echo "▶ Instalando dependencias..."
npm ci --omit=dev
echo "✓ Dependencias instaladas"

# 3. Generar cliente Prisma
echo "▶ Generando cliente Prisma..."
npx prisma generate
echo "✓ Cliente Prisma generado"

# 4. Ejecutar migraciones
echo "▶ Ejecutando migraciones de base de datos..."
npx prisma migrate deploy
echo "✓ Migraciones aplicadas"

# 5. Build
echo "▶ Construyendo aplicación..."
npm run build
echo "✓ Build completado"

# 6. Health check post-deploy (si HEALTH_TOKEN está configurado)
if [ -n "${HEALTH_TOKEN:-}" ] && [ -n "${NEXTAUTH_URL:-}" ]; then
  echo "▶ Verificando health check..."
  sleep 3
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    -H "x-health-token: $HEALTH_TOKEN" \
    "$NEXTAUTH_URL/api/health" || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "✓ Health check OK"
  else
    echo "⚠ Health check retornó HTTP $STATUS — verifica los servicios"
  fi
fi

echo ""
echo "✓ Deploy $ENV completado"
echo "  Inicia el servidor con: npm run start"
