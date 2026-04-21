# ControlSUNAT — Guía de Despliegue

## Requisitos

- Node.js 20+
- PostgreSQL 14+ (local, Neon, Supabase, Railway, etc.)
- npm 10+

---

## 1. Instalación Local

```bash
# Clonar el repositorio
git clone <repo-url>
cd sunat-platform

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores reales

# Generar cliente Prisma
npm run db:generate

# Crear tablas en la base de datos
npm run db:push

# Poblar con datos de demo
npm run db:seed

# Iniciar en desarrollo
npm run dev
```

Accede en: http://localhost:3000

**Credenciales demo:**
- Email: `carlos.mendoza@corpandina.com`
- Password: `password123`

---

## 2. Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secreto para firmar tokens JWT (mín. 32 chars) | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL pública de la app | `https://tu-app.vercel.app` |
| `NODE_ENV` | Entorno | `production` |

---

## 3. Deploy en Vercel (recomendado)

### Paso 1 — Preparar base de datos externa

Usa uno de estos servicios gratuitos:
- **Neon** (recomendado): https://neon.tech — PostgreSQL serverless gratis
- **Supabase**: https://supabase.com — PostgreSQL gratis
- **Railway**: https://railway.app — PostgreSQL gratis

Copia el `DATABASE_URL` que te dan.

### Paso 2 — Subir a GitHub

```bash
git init
git add .
git commit -m "feat: ControlSUNAT MVP"
git remote add origin https://github.com/tu-usuario/sunat-platform.git
git push -u origin main
```

### Paso 3 — Conectar a Vercel

1. Ve a https://vercel.com/new
2. Importa tu repositorio de GitHub
3. En **Root Directory** pon: `sunat-platform`
4. En **Framework Preset** selecciona: `Next.js`
5. En **Environment Variables** agrega:

```
DATABASE_URL     = postgresql://user:pass@host/db?sslmode=require
JWT_SECRET       = tu-secreto-seguro-de-32-chars-minimo
NEXTAUTH_URL     = https://tu-app.vercel.app
NODE_ENV         = production
```

6. Click **Deploy**

### Paso 4 — Inicializar base de datos en producción

Después del primer deploy, ejecuta desde tu máquina local apuntando a la DB de producción:

```bash
# Temporalmente cambia DATABASE_URL en .env a la URL de producción
DATABASE_URL="postgresql://..." npm run db:push
DATABASE_URL="postgresql://..." npm run db:seed
```

O usa el panel de Neon/Supabase para ejecutar las migraciones.

---

## 4. Build de Producción Local

```bash
npm run build
npm run start
```

---

## 5. Comandos de Base de Datos

```bash
npm run db:generate   # Regenerar cliente Prisma (después de cambios en schema)
npm run db:push       # Sincronizar schema con la DB (sin migraciones)
npm run db:migrate    # Crear migración formal (para producción real)
npm run db:seed       # Poblar con datos de demo
npm run db:studio     # Abrir Prisma Studio (GUI para la DB)
npm run db:reset      # Resetear DB completamente (¡BORRA TODOS LOS DATOS!)
```

---

## 6. Estructura del Proyecto

```
sunat-platform/
├── src/
│   ├── app/
│   │   ├── (dashboard)/     # Páginas del dashboard
│   │   ├── api/             # API Routes (backend)
│   │   └── login/           # Página de login
│   ├── components/          # Componentes React
│   ├── lib/                 # Utilidades, hooks, auth
│   └── server/              # Servicios y repositorios
├── prisma/
│   ├── schema.prisma        # Schema de base de datos
│   └── seed.ts              # Datos de demo
├── .env.example             # Template de variables de entorno
└── DEPLOY.md                # Este archivo
```

---

## 7. Notas de Seguridad para Producción

- [ ] Cambiar `JWT_SECRET` por un valor aleatorio seguro (`openssl rand -base64 32`)
- [ ] Usar `DATABASE_URL` con SSL (`?sslmode=require`)
- [ ] Configurar `NEXTAUTH_URL` con la URL real de producción
- [ ] Revisar que `NODE_ENV=production` esté configurado
- [ ] Considerar agregar rate limiting en `/api/auth/login`
- [ ] Configurar CORS si se expone la API a terceros
