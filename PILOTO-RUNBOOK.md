# ControlSUNAT — Runbook de Piloto Real
> Modo: acompañamiento de puesta en marcha  
> Audiencia: quien ejecuta el primer piloto con 1 empresa real  
> Última actualización: 2026-04-21

---

## A. Variables de Entorno — Qué Necesitas Completar

### Obligatorias para piloto real (sin estas, no arranca o no funciona)

| Variable | Cómo obtenerla | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Tu proveedor PostgreSQL (Railway, Supabase, Neon, RDS) | `postgresql://user:pass@host:5432/sunat_staging?sslmode=require` |
| `JWT_SECRET` | Generar: `openssl rand -base64 32` | `K8mP2xQr...` (mín. 32 chars) |
| `NEXTAUTH_URL` | Tu dominio staging con HTTPS | `https://staging.tudominio.com` |
| `STORAGE_PROVIDER` | Fijo: `s3` | `s3` |
| `S3_BUCKET` | Nombre del bucket que creaste | `sunat-staging-docs` |
| `S3_REGION` | Región del bucket | `us-east-1` |
| `S3_ACCESS_KEY_ID` | Credencial IAM o R2 API token | `AKIA...` |
| `S3_SECRET_ACCESS_KEY` | Credencial IAM o R2 secret | `wJalr...` |
| `SUNAT_PROVIDER` | Fijo: `real` | `real` |
| `SUNAT_ENCRYPTION_KEY` | Generar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | `a3f8c2...` (64 chars hex) |

### Obligatorias para jobs reales (sin estas, los jobs no persisten entre reinicios)

| Variable | Cómo obtenerla | Ejemplo |
|---|---|---|
| `REDIS_URL` | Upstash, Redis Cloud, o instancia propia | `rediss://:token@host:6380` |

### Opcionales pero recomendadas para staging

| Variable | Para qué sirve | Default si no se configura |
|---|---|---|
| `S3_ENDPOINT` | Solo si usas Cloudflare R2 | No aplica (usa AWS S3) |
| `S3_PUBLIC_URL` | CDN público para URLs de documentos | Construye URL de S3 automáticamente |
| `HEALTH_TOKEN` | Protege `/api/health` de acceso público | Sin protección (cualquiera puede verlo) |
| `SYNC_CRON` | Horario del cron diario | `0 7 * * *` (02:00 hora Perú) |
| `SENTRY_DSN` | Monitoreo de errores en producción | Sin monitoreo externo |

### No necesarias para piloto (puedes ignorarlas ahora)

- `SUNAT_CLIENT_ID` / `SUNAT_CLIENT_SECRET` / `SUNAT_RUC` — solo si no configuras credenciales por empresa desde la UI
- `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` — solo si usas Sentry

---

## B. Runbook Operativo — Paso a Paso

### PASO 1 — Configurar .env en el servidor

```bash
# En el servidor de staging, copia la plantilla
cp .env.staging.example .env

# Edita con tus valores reales
nano .env   # o vim, o el editor de tu plataforma
```

Contenido mínimo funcional para piloto:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/sunat_staging?sslmode=require
JWT_SECRET=<resultado de: openssl rand -base64 32>
NEXTAUTH_URL=https://staging.tudominio.com
STORAGE_PROVIDER=s3
S3_BUCKET=sunat-staging-docs
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=<tu access key>
S3_SECRET_ACCESS_KEY=<tu secret key>
REDIS_URL=<tu redis url>
SUNAT_PROVIDER=real
SUNAT_ENCRYPTION_KEY=<resultado de: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
HEALTH_TOKEN=<resultado de: openssl rand -hex 32>
SYNC_CRON="0 7 * * *"
```

### PASO 2 — Verificar variables antes de continuar

```bash
npm run check:env
```

Resultado esperado: `✓ Startup check PASSED`  
Si falla: corrige las variables marcadas con `✗` antes de continuar.

### PASO 3 — Instalar dependencias y generar cliente Prisma

```bash
npm ci
npx prisma generate
```

### PASO 4 — Ejecutar migraciones

```bash
npx prisma migrate deploy
```

Resultado esperado:
```
Applying migration `20240421000000_initial_schema`
Applying migration `20240422000000_add_sunat_credentials`
Applying migration `20260421000000_add_sync_executions`
All migrations have been successfully applied.
```

Si falla: verifica que `DATABASE_URL` sea correcto y que el servidor PostgreSQL esté accesible.

### PASO 5 — Seed inicial (SOLO la primera vez)

> ⚠️ El seed **borra toda la base de datos** antes de insertar. Solo ejecutar en base de datos vacía.

```bash
npm run db:seed
```

Resultado esperado:
```
🌱 Starting seed...
✅ Database cleaned
✅ Roles created
✅ Users created
✅ Company created
✅ User roles assigned
✅ Suppliers created
✅ Customers created
✅ Vouchers created
✅ Accounts created
✅ Alerts created
🎉 Seed completed successfully!

📧 Login credentials:
Email: carlos.mendoza@corpandina.com
Password: password123

Email: admin@sunat.com
Password: password123
```

> Para piloto real: después del seed, cambia las contraseñas desde la UI o directamente en DB.

### PASO 6 — Build y arrancar

```bash
npm run build
npm run start
```

El servidor arranca en el puerto 3000 por defecto.  
En los logs deberías ver:
```
[JobQueue] Using BullMQ with Redis        ← confirma Redis activo
[Scheduler] BullMQ daily sync registered  ← confirma cron activo
```

Si ves `Using in-process queue (no REDIS_URL)` → Redis no está configurado.

### PASO 7 — Verificar health check

```bash
curl -s -H "x-health-token: TU_HEALTH_TOKEN" \
  https://staging.tudominio.com/api/health | python3 -m json.tool
```

Resultado esperado:
```json
{
  "status": "ok",
  "services": {
    "database": { "ok": true, "message": "PostgreSQL conectado", "latencyMs": 12 },
    "storage":  { "ok": true, "message": "Storage S3 operativo", "latencyMs": 145 },
    "redis":    { "ok": true, "message": "Redis conectado", "latencyMs": 8 },
    "sunat":    { "ok": true, "message": "SUNAT provider: real (mock)" }
  }
}
```

Si `status` es `degraded`: revisa el servicio que tiene `ok: false`.

### PASO 8 — Entrar al sistema

1. Abre `https://staging.tudominio.com/login`
2. Login con: `carlos.mendoza@corpandina.com` / `password123`
3. Deberías ver el dashboard con datos de demo (empresa CORPORACIÓN ANDINA S.A.C.)

### PASO 9 — Configurar la empresa real del piloto

Tienes dos opciones:

**Opción A — Usar la empresa del seed y actualizar sus datos:**
1. Ir a `/configuracion`
2. Actualizar RUC, razón social y datos de la empresa real

**Opción B — Crear empresa nueva (recomendado para piloto limpio):**
1. Ir a `/configuracion` → sección Empresa
2. Crear nueva empresa con el RUC real del cliente piloto
3. Asignar el usuario al rol ADMIN_EMPRESA de esa empresa

### PASO 10 — Guardar credenciales SUNAT

1. Ir a `/configuracion` → sección "Credenciales SUNAT"
2. Completar:
   - **RUC**: RUC de la empresa (11 dígitos)
   - **Client ID**: el `client_id` de SUNAT SOL
   - **Client Secret**: el `client_secret` de SUNAT SOL
3. Clic en "Guardar credenciales"

> Las credenciales se guardan encriptadas con AES-256-GCM usando tu `SUNAT_ENCRYPTION_KEY`.

### PASO 11 — Probar conexión SUNAT

1. En `/configuracion` → clic en "Probar conexión"
2. Resultado esperado: `"Conexión SUNAT exitosa"`
3. Si falla: ver sección D (Troubleshooting)

También puedes verificar vía API:
```bash
curl -X POST https://staging.tudominio.com/api/sunat/test-connection \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=<tu-token>" \
  -d '{"companyId":"<uuid-empresa>"}'
```

### PASO 12 — Lanzar sync manual

1. Ir a `/descargas`
2. Seleccionar período (mes actual)
3. Clic en "Descarga Masiva (XML+PDF+CDR)"
4. El job aparece en historial con estado `PENDING` → `PROCESSING` → `COMPLETED`

O vía API:
```bash
curl -X POST https://staging.tudominio.com/api/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=<tu-token>" \
  -d '{
    "companyId": "<uuid-empresa>",
    "fechaInicio": "2026-04-01",
    "fechaFin": "2026-04-21",
    "downloadFiles": true
  }'
```

Resultado esperado:
```json
{
  "success": true,
  "data": {
    "estado": "COMPLETED",
    "docsNuevos": 47,
    "docsOk": 47,
    "docsError": 0,
    "duracionMs": 12340
  },
  "message": "Sincronización completada. 47 documentos nuevos descubiertos."
}
```

### PASO 13 — Verificar documentos descargados

1. Ir a `/documentos` → deben aparecer los comprobantes descubiertos
2. Ir a `/compras` → deben aparecer las facturas de compra
3. Ir a `/ventas` → deben aparecer las facturas de venta
4. Ir a `/dashboard` → KPIs deben reflejar los datos reales

### PASO 14 — Verificar historial de sync

```bash
curl "https://staging.tudominio.com/api/sync?companyId=<uuid>" \
  -H "Cookie: auth-token=<tu-token>"
```

Resultado esperado: array de `sync_executions` con `estado: "COMPLETED"`.

### PASO 15 — Verificar logs

```bash
# Si usas PM2
pm2 logs sunat-platform --lines 100

# Si usas systemd
journalctl -u sunat-platform -n 100 --no-pager

# Si usas Docker
docker logs sunat-platform --tail 100

# Si usas Railway/Render/Fly.io
# Ver logs desde el dashboard de la plataforma
```

Busca en los logs:
- `[SUNAT] Token obtained` → autenticación SUNAT OK
- `[Discovery] Discovery complete` → descubrimiento OK
- `[DownloadWorker] Document saved` → archivos guardados OK
- `[SyncService] Sync completed` → sync completa OK

---

## C. Checklist de Piloto Real

### Prerequisitos (antes de arrancar)

- [ ] PostgreSQL accesible desde el servidor
- [ ] Bucket S3/R2 creado con permisos de lectura/escritura
- [ ] Redis accesible desde el servidor
- [ ] Dominio con HTTPS configurado
- [ ] Credenciales SUNAT reales disponibles (client_id + client_secret)
- [ ] `SUNAT_ENCRYPTION_KEY` generado y guardado de forma segura
- [ ] `.env` completado con todos los valores obligatorios

### Validación de infraestructura

- [ ] `npm run check:env` → PASSED
- [ ] `npx prisma migrate deploy` → sin errores
- [ ] `npm run build` → sin errores
- [ ] `GET /api/health` → `status: "ok"` en todos los servicios
- [ ] Logs de arranque muestran `Using BullMQ with Redis`
- [ ] Logs de arranque muestran `BullMQ daily sync registered`

### Validación de empresa

- [ ] Login exitoso con usuario real
- [ ] Empresa piloto visible en selector de empresa activa
- [ ] Credenciales SUNAT guardadas sin error
- [ ] Prueba de conexión SUNAT → `"Conexión SUNAT exitosa"`

### Validación de sync

- [ ] Sync manual lanzada desde `/descargas` o API
- [ ] Job aparece en historial con `estado: COMPLETED`
- [ ] `docsNuevos > 0` (al menos 1 comprobante descubierto)
- [ ] `docsError = 0` (o errores explicados)
- [ ] `GET /api/sync?companyId=X` muestra la ejecución registrada
- [ ] `sunat_credentials.lastSyncAt` actualizado

### Validación documental

- [ ] `/documentos` muestra comprobantes con tieneXML/tienePDF/tieneCDR
- [ ] Archivos visibles en bucket S3/R2
- [ ] `/compras` muestra facturas de compra del período
- [ ] `/ventas` muestra facturas de venta del período
- [ ] `/dashboard` KPIs reflejan datos reales (no ceros)

### Validación multiempresa

- [ ] Cambiar empresa activa → dashboard recarga con datos de la nueva empresa
- [ ] Cambiar empresa activa → compras/ventas recargan
- [ ] Usuario sin acceso a empresa X recibe 403 al intentar acceder

### Señales de éxito del piloto

1. `GET /api/health` → `status: "ok"` en los 4 servicios
2. Sync manual completa con `docsNuevos > 0`
3. Comprobantes reales visibles en `/compras` y `/ventas`
4. Archivos XML/PDF/CDR en el bucket S3/R2
5. Dashboard muestra montos reales de la empresa piloto
6. Logs sin errores críticos (`[ERROR]`)

### Bloqueantes (si alguno falla, el piloto no puede continuar)

- `database.ok: false` → sin DB no hay nada
- `storage.ok: false` → los archivos no se pueden guardar
- Prueba de conexión SUNAT falla → no hay datos reales
- `npm run check:env` falla → variables mal configuradas
- `npx prisma migrate deploy` falla → schema desactualizado

---

## D. Troubleshooting

| Síntoma | Causa probable | Qué revisar | Acción |
|---|---|---|---|
| `GET /api/health` retorna 401 | `HEALTH_TOKEN` no enviado o incorrecto | Header `x-health-token` | Agregar `-H "x-health-token: TU_TOKEN"` al curl |
| `database.ok: false` | `DATABASE_URL` incorrecto o DB inaccesible | Conectividad de red, credenciales, SSL | `psql "$DATABASE_URL"` para probar conexión directa |
| `database.ok: false` con "SSL" en el error | Falta `?sslmode=require` en la URL | `DATABASE_URL` | Agregar `?sslmode=require` al final de la URL |
| `redis.ok: false` | `REDIS_URL` incorrecto o Redis inaccesible | URL, puerto, contraseña | `redis-cli -u "$REDIS_URL" ping` |
| `storage.ok: false` con "credentials" | `S3_ACCESS_KEY_ID` o `S3_SECRET_ACCESS_KEY` incorrectos | Credenciales IAM/R2 | Verificar permisos: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` |
| `storage.ok: false` con "bucket" | Bucket no existe o nombre incorrecto | `S3_BUCKET` | Crear el bucket o corregir el nombre |
| `storage.ok: false` con R2 | `S3_ENDPOINT` incorrecto | URL del endpoint R2 | Formato: `https://<account_id>.r2.cloudflarestorage.com` |
| Prueba de conexión SUNAT falla con "Credenciales inválidas" | `client_id` o `client_secret` incorrectos | Credenciales en `/configuracion` | Verificar en SUNAT SOL que las credenciales estén activas |
| Prueba de conexión SUNAT falla con "No se pudo conectar" | Servidor no tiene acceso a internet o SUNAT está caído | Conectividad saliente del servidor | `curl https://api-seguridad.sunat.gob.pe` desde el servidor |
| Prueba de conexión SUNAT falla con "Token SUNAT expirado" | El token se invalidó | Credenciales en DB | Guardar credenciales nuevamente en `/configuracion` |
| Sync crea job pero no descarga (job queda en PENDING) | Redis no configurado o BullMQ no inicializado | Logs de arranque | Verificar que los logs muestren `Using BullMQ with Redis` |
| Sync crea job pero no descarga (job queda en PROCESSING) | Worker colgado o error silencioso | Logs del worker | Buscar `[DownloadWorker]` en logs |
| Sync completa pero `docsNuevos: 0` | No hay comprobantes en el período consultado | Período de fechas | Ampliar el rango de fechas en la sync |
| Sync completa pero `docsNuevos: 0` con SUNAT mock | `SUNAT_PROVIDER` no es `real` | Variable de entorno | Verificar `SUNAT_PROVIDER=real` en `.env` |
| Documentos no aparecen en `/documentos` | Sync no completó o companyId incorrecto | Estado del job en `/descargas` | Verificar que el job esté `COMPLETED` |
| Compras no se reflejan | Vouchers creados con RUC emisor ≠ RUC empresa | Lógica de filtro COMPRA/VENTA | El filtro usa `rucReceptor = company.ruc` para compras |
| Cambio de empresa no recarga | `useActiveCompany` no propagó el cambio | Consola del navegador | Verificar que no haya errores JS en consola |
| Login falla con "Email o contraseña incorrectos" | Credenciales incorrectas o usuario no existe | Tabla `users` en DB | Verificar con `npm run db:seed` o crear usuario manualmente |
| Login falla con "No se pudo conectar a la base de datos" | DB inaccesible al momento del login | `DATABASE_URL`, conectividad | Verificar health check de DB |
| Cookie no se guarda (sesión no persiste) | `NEXTAUTH_URL` no coincide con el dominio real | `NEXTAUTH_URL` en `.env` | Debe ser exactamente el dominio desde el que accedes |
| Cookie no se guarda en HTTPS | `NODE_ENV` no es `production` | Variable de entorno | Verificar `NODE_ENV=production` |
| `npm run check:env` falla con SUNAT_ENCRYPTION_KEY | Clave tiene longitud incorrecta | Longitud de la clave | Debe tener exactamente 64 caracteres hexadecimales |

---

## E. Comandos Exactos de Operación

### Staging local (para probar antes de subir al servidor)

```bash
# Clonar y preparar
git clone <repo>
cd sunat-platform
cp .env.staging.example .env
# Editar .env con valores reales

# Instalar y preparar
npm install
npm run check:env
npx prisma generate
npx prisma migrate deploy
npm run db:seed        # Solo primera vez

# Arrancar en modo producción local
npm run build
npm run start
```

### Migración (cada deploy)

```bash
# Verificar estado de migraciones
npx prisma migrate status

# Aplicar migraciones pendientes
npx prisma migrate deploy
```

### Seed (solo primera vez o para resetear demo)

```bash
# ⚠️ BORRA TODOS LOS DATOS — solo en DB vacía o de demo
npm run db:seed
```

### Start (servidor)

```bash
# Producción
npm run build && npm run start

# Con PM2 (recomendado para staging persistente)
npm run build
pm2 start npm --name "sunat-platform" -- start
pm2 save
pm2 startup
```

### Health check

```bash
# Con token (recomendado)
curl -s \
  -H "x-health-token: $HEALTH_TOKEN" \
  https://staging.tudominio.com/api/health \
  | python3 -m json.tool

# Sin token (si no configuraste HEALTH_TOKEN)
curl -s https://staging.tudominio.com/api/health | python3 -m json.tool

# Solo verificar que responde 200
curl -o /dev/null -w "%{http_code}" \
  -H "x-health-token: $HEALTH_TOKEN" \
  https://staging.tudominio.com/api/health
```

### Logs

```bash
# PM2
pm2 logs sunat-platform --lines 200
pm2 logs sunat-platform --lines 200 | grep ERROR
pm2 logs sunat-platform --lines 200 | grep "\\[SUNAT\\]"
pm2 logs sunat-platform --lines 200 | grep "\\[SyncService\\]"

# Docker
docker logs sunat-platform --tail 200
docker logs sunat-platform --tail 200 2>&1 | grep ERROR

# systemd
journalctl -u sunat-platform -n 200 --no-pager
journalctl -u sunat-platform -n 200 --no-pager | grep ERROR
```

### Prueba manual del sync (con curl)

```bash
# 1. Login y obtener cookie
curl -c cookies.txt -X POST https://staging.tudominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"carlos.mendoza@corpandina.com","password":"password123"}'

# 2. Obtener companyId
curl -b cookies.txt https://staging.tudominio.com/api/auth/me \
  | python3 -m json.tool

# 3. Lanzar sync manual (reemplaza COMPANY_ID)
curl -b cookies.txt -X POST https://staging.tudominio.com/api/sync \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "COMPANY_ID",
    "fechaInicio": "2026-04-01",
    "fechaFin": "2026-04-21",
    "downloadFiles": true
  }' | python3 -m json.tool

# 4. Ver historial de sync
curl -b cookies.txt \
  "https://staging.tudominio.com/api/sync?companyId=COMPANY_ID" \
  | python3 -m json.tool

# 5. Ver jobs de descarga
curl -b cookies.txt \
  "https://staging.tudominio.com/api/download-jobs?companyId=COMPANY_ID" \
  | python3 -m json.tool

# 6. Ver comprobantes
curl -b cookies.txt \
  "https://staging.tudominio.com/api/vouchers?companyId=COMPANY_ID&tipo=COMPRA" \
  | python3 -m json.tool
```

---

## F. Cierre — Resumen Ejecutivo

### Qué tienes que hacer tú

1. **Configurar `.env`** con los 10 valores obligatorios (ver sección A)
2. **Crear el bucket S3/R2** y configurar las credenciales de acceso
3. **Configurar Redis** (Upstash es la opción más rápida para staging)
4. **Ejecutar la secuencia de arranque** (pasos 1-7 del runbook)
5. **Configurar credenciales SUNAT** de la empresa piloto desde `/configuracion`
6. **Lanzar la primera sync manual** desde `/descargas`
7. **Verificar que los datos aparecen** en compras, ventas y documentos

### Qué ya hace el sistema solo

- Encripta y guarda las credenciales SUNAT en DB (AES-256-GCM)
- Descubre comprobantes nuevos en SUNAT sin duplicar los existentes
- Descarga XML, PDF y CDR y los guarda en S3/R2
- Registra cada sync en `sync_executions` con duración y resultado
- Ejecuta sync diaria automática a las 02:00 hora Perú (con Redis activo)
- Reintenta jobs fallidos 3 veces con backoff exponencial
- Recarga datos de todos los módulos al cambiar empresa activa
- Aplica rate limiting en login y APIs críticas
- Registra auditoría de acciones sensibles
- Protege cada endpoint verificando que el usuario tenga acceso a la empresa

### Señal que confirma que el piloto salió bien

```
GET /api/health → status: "ok" (los 4 servicios en verde)
POST /api/sync  → estado: "COMPLETED", docsNuevos > 0
/compras        → muestra facturas reales de la empresa piloto
/documentos     → muestra archivos con tieneXML/tienePDF/tieneCDR en verde
Bucket S3/R2    → contiene archivos en companies/<id>/vouchers/...
Logs            → sin líneas [ERROR] relacionadas con SUNAT o storage
```

### Qué te bloquearía para pasar a producción

| Bloqueante | Solución |
|---|---|
| Sin credenciales SUNAT reales | Obtener client_id + client_secret de SUNAT SOL |
| Sin bucket S3/R2 real | Crear bucket en AWS o Cloudflare R2 |
| Sin Redis real | Contratar Upstash (plan gratuito alcanza para piloto) |
| Sin dominio HTTPS | Configurar dominio + certificado SSL (Let's Encrypt) |
| `SUNAT_ENCRYPTION_KEY` no guardado | Guardar en gestor de secretos antes de perderlo |
| Seed ejecutado en DB de producción | Nunca ejecutar `db:seed` en producción — borra todo |
