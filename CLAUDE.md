@AGENTS.md

# ControlSUNAT — Estado Preproducción

## Arquitectura de Jobs

- `src/lib/jobs/index.ts` — QueueFacade: BullMQ (Redis) o in-process fallback
- `src/lib/jobs/download.worker.ts` — Worker de descarga XML/PDF/CDR
- `src/lib/jobs/sync.service.ts` — Orquestador de sync (discovery + download)
- `src/lib/jobs/scheduler.ts` — Cron diario (BullMQ repeat o node-cron)
- `src/lib/jobs/init.ts` — Inicialización en startup (via instrumentation.ts)
- `src/instrumentation.ts` — Hook de Next.js para inicializar jobs al arrancar

## Discovery vs Download

- `src/lib/sunat/discovery.ts` — Descubre comprobantes nuevos en SUNAT, crea Voucher records, evita duplicados
- `src/lib/sunat/real.provider.ts` — queryDocuments() + downloadDocument() contra API SUNAT real
- Flujo: discovery → crea Vouchers con estado=PENDIENTE → download worker descarga XML/PDF/CDR

## APIs nuevas

- `POST /api/sync` — Sync manual para una empresa (discovery + enqueue download)
- `GET  /api/sync?companyId=` — Historial de sync executions
- `GET  /api/health` — Health check: DB, Storage, Redis, SUNAT

## Multiempresa

Todos los hooks usan `useActiveCompany()` (no `session.companyRoles[0]`):
- `useDashboardData`, `useVouchers`, `useAccounts`, `useAlerts`, `useDetracciones`, `useDocuments`
- Al cambiar empresa activa, todos los módulos recargan automáticamente

## Storage

- `STORAGE_PROVIDER=local` → `./storage/` (desarrollo)
- `STORAGE_PROVIDER=s3` → AWS S3 o Cloudflare R2
- Verificar con `GET /api/health` que upload/read/delete funcionen

## Variables de entorno para preproducción

```env
STORAGE_PROVIDER=s3
S3_BUCKET=sunat-documents
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=...          # Solo R2
REDIS_URL=redis://...    # Activa BullMQ real
SUNAT_PROVIDER=real
SUNAT_ENCRYPTION_KEY=... # 64 hex chars
SYNC_CRON="0 7 * * *"   # 02:00 hora Perú
```

## Migración pendiente

Ejecutar antes de arrancar en preproducción:
```bash
npx prisma migrate deploy
```
Agrega tabla `sync_executions`.

## Comandos

```bash
npm run build          # Verificar build
npm run lint           # Verificar lint
npx tsc --noEmit       # Verificar tipos
GET /api/health        # Verificar servicios en runtime
```
