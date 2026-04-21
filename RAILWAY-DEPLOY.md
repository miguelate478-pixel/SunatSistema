# ControlSUNAT — Deploy en Railway

## Configuración del proyecto en Railway

### Root Directory
```
sunat-platform
```
> Railway debe apuntar a esta subcarpeta, no a la raíz del repo.

### Build Command (ya en railway.toml)
```
npm ci && npx prisma generate && npm run build
```

### Start Command (ya en railway.toml)
```
npx prisma migrate deploy && npm run start -- -p ${PORT:-3000}
```

### Health Check Path
```
/api/health
```

---

## Servicios a crear en Railway

### 1. PostgreSQL
- Crear servicio: **Add Service → Database → PostgreSQL**
- Railway inyecta automáticamente `DATABASE_URL` al servicio de la app
- No necesitas configurarla manualmente si están en el mismo proyecto

### 2. Redis / Valkey
- Crear servicio: **Add Service → Database → Redis** (o Valkey)
- Railway inyecta automáticamente `REDIS_URL`
- Si no aparece automáticamente, copia la variable desde el servicio Redis

### 3. App (Next.js)
- Crear servicio: **Add Service → GitHub Repo**
- Seleccionar el repo conectado
- **Root Directory**: `sunat-platform`
- Railway detecta automáticamente el `railway.toml`

---

## Variables de Entorno — Pegar en Railway

Ve a tu servicio de app → **Variables** → pega estas una por una:

### Obligatorias (sin estas no arranca)

```
NODE_ENV=production
```

```
JWT_SECRET=<genera con: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
```

```
NEXTAUTH_URL=https://<tu-subdominio>.up.railway.app
```
> Reemplaza con la URL que Railway te asigna. La encuentras en Settings → Domains.

```
SUNAT_ENCRYPTION_KEY=<genera con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```
> Debe ser exactamente 64 caracteres hexadecimales. Guárdalo en un lugar seguro — si lo pierdes, las credenciales SUNAT en DB quedan ilegibles.

```
SUNAT_PROVIDER=mock
```
> Usar `mock` para staging inicial. Cambiar a `real` cuando tengas credenciales SUNAT reales.

```
STORAGE_PROVIDER=local
```
> Usar `local` para staging inicial (Railway tiene filesystem efímero — los archivos se pierden en cada deploy). Cambiar a `s3` cuando configures S3/R2.

### Para storage real (S3 o Cloudflare R2) — cuando estés listo

```
STORAGE_PROVIDER=s3
S3_BUCKET=sunat-staging-documents
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=<tu-access-key>
S3_SECRET_ACCESS_KEY=<tu-secret-key>
```

Para Cloudflare R2 (recomendado — sin egress fees):
```
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
S3_PUBLIC_URL=https://pub-<hash>.r2.dev
```

### Para health check protegido (recomendado)

```
HEALTH_TOKEN=<genera con: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))">
```

### Para sync automática

```
SYNC_CRON=0 7 * * *
```

### DATABASE_URL y REDIS_URL
Railway las inyecta automáticamente si los servicios están en el mismo proyecto.
Si necesitas configurarlas manualmente:
```
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/<db>?sslmode=require
REDIS_URL=redis://default:<password>@<host>:6379
```

---

## Pasos exactos en Railway

### Paso 1 — Crear proyecto
1. Ir a [railway.app](https://railway.app) → **New Project**
2. Seleccionar **Deploy from GitHub repo**
3. Autorizar Railway en GitHub si no está autorizado
4. Seleccionar el repositorio

### Paso 2 — Configurar Root Directory
1. En el servicio creado → **Settings**
2. **Root Directory**: `sunat-platform`
3. Railway detectará el `railway.toml` automáticamente

### Paso 3 — Agregar PostgreSQL
1. En el proyecto → **+ New** → **Database** → **Add PostgreSQL**
2. Railway conecta automáticamente `DATABASE_URL` al servicio de app

### Paso 4 — Agregar Redis
1. En el proyecto → **+ New** → **Database** → **Add Redis**
2. Railway conecta automáticamente `REDIS_URL` al servicio de app

### Paso 5 — Configurar variables de entorno
1. Clic en el servicio de app → **Variables**
2. Pegar todas las variables obligatorias de la sección anterior
3. **Importante**: `NEXTAUTH_URL` debe ser la URL de Railway
   - Ir a **Settings → Domains** para ver la URL asignada
   - Formato: `https://<nombre>.up.railway.app`

### Paso 6 — Deploy
1. Railway hace deploy automático al detectar el push a GitHub
2. O forzar deploy: **Deploy** → **Deploy Now**
3. Ver logs en tiempo real en la pestaña **Deployments**

### Paso 7 — Verificar que está online
```bash
# Health check básico (sin token)
curl https://<tu-app>.up.railway.app/api/health

# Health check completo (con token)
curl -H "x-health-token: TU_HEALTH_TOKEN" \
  https://<tu-app>.up.railway.app/api/health
```

Respuesta esperada:
```json
{"status":"ok"}
```

### Paso 8 — Seed inicial (solo primera vez)
Railway no ejecuta el seed automáticamente. Tienes dos opciones:

**Opción A — Desde Railway Shell:**
1. En el servicio → **Shell** (o usar Railway CLI)
2. Ejecutar: `npm run db:seed`

**Opción B — Desde tu máquina local con Railway CLI:**
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Conectar al proyecto
railway link

# Ejecutar seed en el entorno de Railway
railway run npm run db:seed
```

### Paso 9 — Conectar dominio propio (opcional)
1. En el servicio → **Settings** → **Domains**
2. **Add Custom Domain**
3. Agregar registro CNAME en tu DNS apuntando a Railway
4. Actualizar `NEXTAUTH_URL` con el dominio propio
5. Hacer redeploy

---

## Validación post-deploy

```bash
# 1. App responde
curl -I https://<tu-app>.up.railway.app/login
# Esperado: HTTP/2 200

# 2. Health check
curl https://<tu-app>.up.railway.app/api/health
# Esperado: {"status":"ok"}

# 3. Login funciona
curl -X POST https://<tu-app>.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"carlos.mendoza@corpandina.com","password":"password123"}'
# Esperado: {"success":true,"user":{...}}
```

---

## Qué falta para operar con una empresa real

| Qué | Cómo |
|---|---|
| Storage persistente | Configurar S3/R2 y cambiar `STORAGE_PROVIDER=s3` |
| Credenciales SUNAT reales | Ir a `/configuracion` → guardar client_id + client_secret |
| `SUNAT_PROVIDER=real` | Cambiar variable en Railway después de configurar credenciales |
| Dominio propio (opcional) | Conectar en Railway Settings → Domains |

---

## Notas importantes sobre Railway

- **Filesystem efímero**: Railway no persiste archivos entre deploys. Con `STORAGE_PROVIDER=local`, los archivos XML/PDF/CDR se pierden en cada deploy. **Configurar S3/R2 antes de usar en producción real.**
- **`DATABASE_URL` y `REDIS_URL`**: Railway las inyecta automáticamente si los servicios están en el mismo proyecto. No las configures manualmente a menos que uses servicios externos.
- **Puerto**: Railway inyecta `$PORT`. El `railway.toml` ya lo maneja con `-- -p ${PORT:-3000}`.
- **SSL**: Railway maneja HTTPS automáticamente. No necesitas configurar certificados.
