# ControlSUNAT — Checklist de Salida a Producción

> Última actualización: 2026-04-21  
> Estado actual: **Staging listo / Piloto real pendiente de credenciales SUNAT**

---

## Estado de Preparación

| Fase | Estado | Notas |
|------|--------|-------|
| Demo comercial | ✅ Listo | Mock provider funcional |
| Staging serio | ✅ Listo | Requiere configurar .env.staging |
| Piloto real (1 empresa) | ⚠️ Pendiente | Requiere credenciales SUNAT reales |
| Producción controlada | ⚠️ Pendiente | Ver bloqueantes abajo |

---

## FASE 1 — Infraestructura

- [ ] **PostgreSQL** configurado con `DATABASE_URL` con SSL (`?sslmode=require`)
- [ ] **Migraciones** ejecutadas: `npx prisma migrate deploy`
- [ ] **S3 / Cloudflare R2** bucket creado y accesible
  - [ ] `STORAGE_PROVIDER=s3`
  - [ ] `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` configurados
  - [ ] Para R2: `S3_ENDPOINT` configurado
  - [ ] Verificar con `GET /api/health` → `storage.ok: true`
- [ ] **Redis** configurado
  - [ ] `REDIS_URL` configurado (Upstash, Redis Cloud, o instancia propia)
  - [ ] Verificar con `GET /api/health` → `redis.ok: true`
- [ ] **Dominio** con HTTPS configurado
  - [ ] `NEXTAUTH_URL=https://tudominio.com`
  - [ ] Certificado SSL válido
- [ ] **Variables de entorno** verificadas: `npm run check:env`

---

## FASE 2 — Base de Datos

- [ ] Migraciones aplicadas sin errores
- [ ] Seed de roles ejecutado: `npm run db:seed`
- [ ] Usuario administrador creado
- [ ] Al menos 1 empresa creada con RUC válido
- [ ] Backup automático configurado (diario mínimo)
- [ ] Connection pooling configurado (PgBouncer o Prisma Accelerate en producción)

---

## FASE 3 — Storage

- [ ] Upload funciona: `GET /api/health` → `storage.ok: true`
- [ ] Lectura funciona (round-trip en health check)
- [ ] Eliminación funciona
- [ ] Signed URLs funcionan (para descarga segura de documentos)
- [ ] Bucket con versionado habilitado (recomendado)
- [ ] Política de retención definida
- [ ] CORS configurado en bucket (si se usan URLs directas)

---

## FASE 4 — Redis / Queues

- [ ] Redis conectado: `GET /api/health` → `redis.ok: true`
- [ ] BullMQ activo (con `REDIS_URL` configurado)
- [ ] Job de descarga crea, procesa y completa correctamente
- [ ] Reintentos funcionan (3 intentos con backoff exponencial)
- [ ] Jobs fallidos registrados en `download_jobs` con `errorMsg`
- [ ] Scheduler diario registrado (verificar en logs al arrancar)
- [ ] `sync_executions` registra cada ejecución con duración y resultado

---

## FASE 5 — Auth / Seguridad

- [ ] `JWT_SECRET` con al menos 32 caracteres aleatorios
- [ ] Cookies `httpOnly: true`, `secure: true` (en producción)
- [ ] Headers de seguridad activos (X-Frame-Options, CSP, etc.)
- [ ] Rate limiting activo en login (10 intentos / 15 min por IP)
- [ ] Rate limiting activo en APIs críticas
- [ ] `requireCompanyAccess()` en todas las rutas con `companyId`
- [ ] Errores internos no expuestos al cliente
- [ ] `HEALTH_TOKEN` configurado para proteger `/api/health`

---

## FASE 6 — SUNAT

- [ ] `SUNAT_PROVIDER=real`
- [ ] `SUNAT_ENCRYPTION_KEY` configurado (64 hex chars)
- [ ] Credenciales SUNAT configuradas por empresa en `/configuracion`
- [ ] Prueba de conexión exitosa: `POST /api/sunat/test-connection`
- [ ] Sync manual exitosa: `POST /api/sync`
- [ ] Documentos descubiertos aparecen en compras/ventas
- [ ] Archivos XML/PDF/CDR descargados y guardados en storage
- [ ] `lastSyncAt` actualizado en `sunat_credentials`

---

## FASE 7 — Multiempresa

- [ ] Al cambiar empresa activa, dashboard recarga con datos correctos
- [ ] Al cambiar empresa activa, compras/ventas recargan
- [ ] Al cambiar empresa activa, detracciones recargan
- [ ] Al cambiar empresa activa, alertas recargan
- [ ] Al cambiar empresa activa, documentos recargan
- [ ] Al cambiar empresa activa, cuentas recargan
- [ ] Al cambiar empresa activa, descargas recargan
- [ ] Usuario sin acceso a empresa X no puede ver datos de empresa X (403)
- [ ] Sync solo ejecuta para empresas con credenciales activas

---

## FASE 8 — Monitoreo

- [ ] Sentry configurado (`SENTRY_DSN`)
- [ ] Logs estructurados en producción (JSON)
- [ ] `GET /api/health` accesible desde monitor externo (con `HEALTH_TOKEN`)
- [ ] Alertas de uptime configuradas (UptimeRobot, Better Uptime, etc.)
- [ ] Alertas de errores en Sentry configuradas

---

## FASE 9 — Backups

- [ ] Backup automático de PostgreSQL (diario)
- [ ] Backup de S3/R2 (versionado o replicación)
- [ ] Procedimiento de restore documentado y probado
- [ ] Backup de variables de entorno en gestor de secretos (Vault, Doppler, etc.)

---

## FASE 10 — Tests

- [ ] `npm run lint` → 0 errores
- [ ] `npx tsc --noEmit` → 0 errores
- [ ] `npm run build` → build exitoso
- [ ] `npm run test` → tests pasan
- [ ] Flujo completo de piloto probado manualmente (ver abajo)

---

## Flujo de Piloto Real (validación manual)

```
1. Login con usuario real
2. Seleccionar empresa activa
3. Ir a /configuracion → configurar credenciales SUNAT
4. Probar conexión → debe retornar "Conexión SUNAT exitosa"
5. Ir a /descargas → crear job MASIVO para el mes actual
6. Verificar que el job aparece en historial con estado PROCESSING → COMPLETED
7. Ir a /compras → verificar que aparecen comprobantes nuevos
8. Ir a /dashboard → verificar KPIs actualizados
9. Ir a /documentos → verificar que aparecen archivos XML/PDF/CDR
10. Cambiar empresa activa → verificar que todos los módulos recargan
11. GET /api/health → todos los servicios en ok: true
12. GET /api/sync?companyId=X → verificar sync_executions registradas
```

---

## Comandos de Operación

```bash
# Verificar entorno antes de arrancar
npm run check:env

# Aplicar migraciones
npx prisma migrate deploy

# Seed inicial (solo primera vez)
npm run db:seed

# Build
npm run build

# Arrancar servidor
npm run start

# Health check (con token)
curl -H "x-health-token: $HEALTH_TOKEN" https://tudominio.com/api/health

# Sync manual via API
curl -X POST https://tudominio.com/api/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=<token>" \
  -d '{"companyId":"<uuid>","downloadFiles":true}'

# Ver historial de sync
curl "https://tudominio.com/api/sync?companyId=<uuid>" \
  -H "Cookie: auth-token=<token>"
```

---

## Qué Falta para Producción Completa

### 🔴 Bloqueantes

1. **Credenciales SUNAT reales** — sin ellas, `SUNAT_PROVIDER=real` no funciona
2. **Bucket S3/R2 real** — storage local no es válido para producción
3. **Redis real** — sin él, los jobs no persisten entre reinicios
4. **Dominio con HTTPS** — requerido para cookies `secure: true`
5. **`SUNAT_ENCRYPTION_KEY`** — requerido para guardar credenciales encriptadas

### 🟡 Recomendados

6. **Sentry** — sin monitoreo de errores, los fallos en producción son ciegos
7. **Backup automático de DB** — sin backup, un fallo de DB es catastrófico
8. **Connection pooling** (PgBouncer o Prisma Accelerate) — para escalar
9. **Seed de roles** ejecutado — sin roles, no hay permisos correctos
10. **`HEALTH_TOKEN`** configurado — sin él, el health endpoint es público

### 🟢 Mejoras Posteriores

11. **CDN para assets** (CloudFront, Cloudflare) — performance
12. **Signed URLs para documentos** — acceso seguro a archivos en S3
13. **Paginación en compras/ventas** — actualmente carga 50 registros
14. **Notificaciones por email** — alertas de sync fallida, detracciones vencidas
15. **2FA para usuarios** — seguridad adicional
16. **Logs centralizados** (Datadog, Logtail) — observabilidad completa
17. **Tests de integración** — cobertura de flujos críticos
18. **Rate limiting por empresa** — prevenir abuso de sync
