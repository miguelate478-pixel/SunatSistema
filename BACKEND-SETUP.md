# 🔧 Backend Setup - Configuración Completa

## ✅ Lo que se ha implementado

### 1. **Arquitectura Backend Completa**
```
src/
├── lib/
│   ├── db/
│   │   ├── prisma.ts          # Cliente Prisma singleton
│   │   └── types.ts           # Tipos TypeScript de Prisma
│   ├── auth/                  # Autenticación (futuro)
│   └── validators/            # Validadores Zod
│       ├── auth.ts
│       ├── company.ts
│       └── voucher.ts
├── server/
│   ├── repositories/          # Capa de acceso a datos
│   │   ├── user.repository.ts
│   │   ├── company.repository.ts
│   │   └── voucher.repository.ts
│   ├── services/              # Lógica de negocio
│   │   ├── auth.service.ts
│   │   └── voucher.service.ts
│   └── modules/               # Módulos organizados
│       ├── vouchers/
│       ├── companies/
│       ├── alerts/
│       └── accounts/
└── app/
    └── api/                   # API Routes (próximo paso)
        ├── auth/
        ├── vouchers/
        ├── companies/
        └── alerts/
```

### 2. **Base de Datos (Prisma + PostgreSQL)**

#### Entidades Implementadas:
- ✅ **User** - Usuarios del sistema
- ✅ **Role** - Roles (SUPER_ADMIN, ADMIN_EMPRESA, CONTABILIDAD, etc.)
- ✅ **UserCompanyRole** - Relación usuario-empresa-rol
- ✅ **Company** - Empresas (multiempresa)
- ✅ **Supplier** - Proveedores
- ✅ **Customer** - Clientes
- ✅ **Voucher** - Comprobantes
- ✅ **VoucherItem** - Ítems de comprobantes
- ✅ **VoucherDocument** - Archivos (XML, PDF, CDR)
- ✅ **Detraction** - Detracciones
- ✅ **AccountReceivable** - Cuentas por cobrar
- ✅ **AccountPayable** - Cuentas por pagar
- ✅ **Alert** - Alertas del sistema
- ✅ **ReportExecution** - Ejecución de reportes
- ✅ **DownloadJob** - Jobs de descarga SUNAT
- ✅ **AuditLog** - Log de auditoría

#### Características:
- ✅ UUIDs en todas las entidades
- ✅ Soft delete donde aplica (deletedAt)
- ✅ Timestamps (createdAt, updatedAt)
- ✅ createdBy en entidades principales
- ✅ Índices optimizados
- ✅ Relaciones bien definidas
- ✅ Tipos Decimal para montos
- ✅ JSON para metadata flexible

### 3. **Validadores (Zod)**
- ✅ Validación de entrada con tipos seguros
- ✅ Schemas para auth, company, voucher
- ✅ Validación de RUC, email, etc.

### 4. **Repositorios**
- ✅ Patrón Repository para acceso a datos
- ✅ Métodos CRUD completos
- ✅ Queries optimizadas
- ✅ Paginación incluida

### 5. **Servicios**
- ✅ Lógica de negocio separada
- ✅ AuthService (login, register, JWT)
- ✅ VoucherService (CRUD, stats, upload)
- ✅ Manejo de errores

### 6. **Seed con Datos Realistas**
- ✅ 2 usuarios demo
- ✅ 6 roles del sistema
- ✅ 1 empresa (CORPORACIÓN ANDINA S.A.C.)
- ✅ 3 proveedores
- ✅ 2 clientes
- ✅ 4 comprobantes (compras y ventas)
- ✅ Detracciones
- ✅ Cuentas por cobrar/pagar
- ✅ 4 alertas

---

## 🚀 Pasos para Configurar

### Paso 1: Instalar PostgreSQL

#### Opción A: Docker (Recomendado)
```bash
docker run --name sunat-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sunat_platform \
  -p 5432:5432 \
  -d postgres:16
```

#### Opción B: Instalación Local
- Descarga PostgreSQL 16: https://www.postgresql.org/download/
- Instala y crea la base de datos `sunat_platform`

### Paso 2: Configurar Variables de Entorno

El archivo `.env` ya está creado con:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sunat_platform?schema=public"
NEXTAUTH_SECRET="sunat-platform-secret-key-change-in-production"
JWT_SECRET="jwt-secret-key-change-in-production"
NODE_ENV="development"
```

**⚠️ Ajusta el DATABASE_URL si usas credenciales diferentes**

### Paso 3: Generar Cliente Prisma
```bash
npm run db:generate
```

### Paso 4: Crear las Tablas
```bash
npm run db:push
```

O si prefieres usar migraciones:
```bash
npm run db:migrate
```

### Paso 5: Poblar con Datos Demo
```bash
npm run db:seed
```

### Paso 6: Verificar (Opcional)
```bash
npm run db:studio
```
Abre Prisma Studio en http://localhost:5555

---

## 📝 Comandos Disponibles

```bash
# Generar cliente Prisma
npm run db:generate

# Push schema a DB (sin migraciones)
npm run db:push

# Crear migración
npm run db:migrate

# Ejecutar seed
npm run db:seed

# Abrir Prisma Studio
npm run db:studio

# Reset completo (⚠️ borra todo)
npm run db:reset
```

---

## 🔐 Credenciales Demo

Después del seed, puedes usar:

**Usuario 1 (Admin Empresa)**
- Email: `carlos.mendoza@corpandina.com`
- Password: `password123`

**Usuario 2 (Super Admin)**
- Email: `admin@sunat.com`
- Password: `password123`

---

## 📊 Datos Seed Incluidos

### Roles
- SUPER_ADMIN
- ADMIN_EMPRESA
- CONTABILIDAD
- TESORERIA
- GERENCIA
- AUDITOR

### Empresa
- **RUC**: 20512345678
- **Razón Social**: CORPORACIÓN ANDINA S.A.C.
- **Plan**: PROFESSIONAL

### Proveedores
1. DISTRIBUIDORA NORTE S.A.C. (20100070970)
2. SUMINISTROS TECH PERU S.A. (20503840121)
3. IMPORTACIONES GLOBALES E.I.R.L. (20601234567)

### Clientes
1. MINERA ANDAHUAYLAS S.A. (20301234567)
2. GRUPO EMPRESARIAL NORTE S.A.C. (20456123789)

### Comprobantes
- 3 facturas de compra
- 1 factura de venta
- Con ítems detallados
- Con detracciones
- Con estados variados

### Alertas
- 4 alertas de diferentes tipos
- Categorizadas por módulo

---

## 🔄 Próximos Pasos

### 1. Crear API Routes
Crear endpoints en `src/app/api/`:

```typescript
// src/app/api/vouchers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { voucherService } from "@/server/services/voucher.service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");
    
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId requerido" },
        { status: 400 }
      );
    }

    const result = await voucherService.getVouchers({
      companyId,
      page: 1,
      limit: 20,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener comprobantes" },
      { status: 500 }
    );
  }
}
```

### 2. Conectar Frontend con Backend
Reemplazar mock data con llamadas a API:

```typescript
// Antes (mock)
import { comprobantesCompras } from "@/lib/mock-data";

// Después (API)
const response = await fetch(`/api/vouchers?companyId=${companyId}`);
const { data } = await response.json();
```

### 3. Implementar Autenticación
- Crear middleware de autenticación
- Proteger rutas
- Implementar sesiones

### 4. Agregar Más Servicios
- AlertService
- ReportService
- AccountService
- DetractionService

---

## 🐛 Troubleshooting

### Error: "Can't reach database server"
```bash
# Verifica que PostgreSQL esté corriendo
docker ps  # Si usas Docker

# O verifica el servicio local
# Windows: Services > PostgreSQL
# Linux/Mac: sudo systemctl status postgresql
```

### Error: "Database does not exist"
```bash
# Crea la base de datos manualmente
psql -U postgres
CREATE DATABASE sunat_platform;
\q
```

### Error: "Prisma Client not generated"
```bash
npm run db:generate
```

### Error en seed: "Unique constraint failed"
```bash
# Reset la base de datos
npm run db:reset
```

---

## 📚 Recursos

- **Prisma Docs**: https://www.prisma.io/docs
- **Next.js API Routes**: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- **Zod Validation**: https://zod.dev
- **PostgreSQL**: https://www.postgresql.org/docs

---

## ✅ Checklist de Implementación

- [x] Schema Prisma completo
- [x] Cliente Prisma configurado
- [x] Tipos TypeScript generados
- [x] Validadores Zod
- [x] Repositorios
- [x] Servicios
- [x] Seed con datos realistas
- [ ] API Routes
- [ ] Middleware de autenticación
- [ ] Conectar frontend
- [ ] Tests

---

**🎉 El backend está listo para ser usado!**

Ejecuta los comandos en orden y tendrás una base de datos funcional con datos de prueba.
