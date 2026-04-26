# Configuración de Storage Persistente (S3 / Cloudflare R2)

## Por qué es necesario

Railway tiene filesystem efímero — los archivos se pierden en cada redeploy.
Para que los XML/PDF/CDR descargados de SUNAT persistan, necesitas configurar S3 o Cloudflare R2.

**Recomendación: Cloudflare R2** — sin costo de egress (descarga), más barato que S3.

---

## Opción A — Cloudflare R2 (recomendado)

### 1. Crear bucket en Cloudflare
1. Ir a [dash.cloudflare.com](https://dash.cloudflare.com) → R2 → Create bucket
2. Nombre: `sunat-documents` (o el que prefieras)
3. Región: Automatic

### 2. Crear API Token
1. R2 → Manage R2 API Tokens → Create API Token
2. Permisos: **Object Read & Write**
3. Bucket: el que creaste
4. Copiar: **Access Key ID** y **Secret Access Key**

### 3. Obtener endpoint
- En el bucket → Settings → S3 API endpoint
- Formato: `https://<account_id>.r2.cloudflarestorage.com`

### 4. Variables en Railway
```
STORAGE_PROVIDER=s3
S3_BUCKET=sunat-documents
S3_REGION=auto
S3_ACCESS_KEY_ID=<tu-access-key-id>
S3_SECRET_ACCESS_KEY=<tu-secret-access-key>
S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
```

---

## Opción B — AWS S3

### Variables en Railway
```
STORAGE_PROVIDER=s3
S3_BUCKET=sunat-documents
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=<tu-access-key>
S3_SECRET_ACCESS_KEY=<tu-secret-key>
```

---

## Verificar que funciona

Después de configurar las variables y hacer redeploy:

```bash
curl -H "x-health-token: TU_HEALTH_TOKEN" \
  https://tu-app.up.railway.app/api/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "services": {
    "storage": { "ok": true, "latencyMs": 45 }
  }
}
```

---

## Notas importantes

- Los archivos ya descargados con `STORAGE_PROVIDER=local` **no se migran automáticamente**.
  Después de configurar S3, vuelve a descargar los documentos desde Descargas SUNAT.
- El bucket debe ser **privado** — el sistema genera URLs firmadas con expiración de 1 hora.
- No necesitas configurar CORS si solo accedes desde el servidor.
