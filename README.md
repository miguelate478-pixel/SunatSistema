# 🏢 Plataforma Inteligente de Control SUNAT y Gestión Empresarial

Sistema web SaaS multiempresa profesional para la gestión integral de comprobantes electrónicos, control tributario, detracciones, reportes gerenciales y análisis con IA.

## 🎯 Características Principales

### ✅ Módulos Implementados

- **Dashboard Ejecutivo**: KPIs en tiempo real, gráficos interactivos, alertas críticas
- **Compras**: Registro completo con filtros avanzados, vista detallada de ítems
- **Ventas**: Gestión de comprobantes emitidos con análisis por cliente
- **Detracciones**: Control SPOT con estados de pago y alertas de vencimiento
- **Documentos**: Repositorio inteligente con organización automática
- **Alertas**: Centro de notificaciones con priorización y categorización
- **Cuentas por Cobrar**: Gestión de cartera con antigüedad
- **Cuentas por Pagar**: Control de obligaciones con proveedores
- **Reportes**: Generación de reportes en múltiples formatos
- **Copiloto IA**: Asistente inteligente para consultas y análisis

### 🎨 Diseño y UX

- ✨ Interfaz moderna tipo SaaS premium
- 🎨 Diseño limpio con Tailwind CSS + shadcn/ui
- 📱 Totalmente responsive
- 🌙 Sidebar colapsable
- 🔔 Sistema de notificaciones en tiempo real
- 📊 Gráficos interactivos con Recharts
- 🎯 Navegación intuitiva

### 🏗️ Arquitectura Técnica

- **Frontend**: Next.js 15 + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Icons**: Lucide React
- **Charts**: Recharts
- **State**: React Hooks
- **Routing**: App Router (Next.js 15)

## 📁 Estructura del Proyecto

```
sunat-platform/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Grupo de rutas del dashboard
│   │   │   ├── layout.tsx        # Layout con sidebar
│   │   │   ├── dashboard/        # Página principal
│   │   │   ├── compras/          # Módulo de compras
│   │   │   ├── ventas/           # Módulo de ventas
│   │   │   ├── detracciones/     # Control de detracciones
│   │   │   ├── documentos/       # Repositorio documental
│   │   │   ├── alertas/          # Centro de alertas
│   │   │   ├── cuentas-cobrar/   # Cuentas por cobrar
│   │   │   ├── cuentas-pagar/    # Cuentas por pagar
│   │   │   ├── reportes/         # Generación de reportes
│   │   │   └── ia/               # Copiloto IA
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Redirect a dashboard
│   │   └── globals.css           # Estilos globales
│   ├── components/
│   │   ├── ui/                   # Componentes base (shadcn/ui)
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   └── progress.tsx
│   │   ├── layout/               # Componentes de layout
│   │   │   ├── sidebar.tsx       # Sidebar con navegación
│   │   │   └── topbar.tsx        # Barra superior
│   │   ├── dashboard/            # Componentes del dashboard
│   │   │   ├── kpi-card.tsx      # Tarjetas KPI
│   │   │   └── charts.tsx        # Gráficos
│   │   └── comprobantes/         # Componentes de comprobantes
│   │       └── comprobante-detail.tsx
│   └── lib/
│       ├── utils.ts              # Utilidades (cn, formatters)
│       └── mock-data.ts          # Datos de demostración
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

## 🚀 Instalación y Ejecución

### Prerrequisitos

- Node.js 18+ 
- npm o yarn

### Pasos

1. **Navegar al directorio del proyecto**:
```bash
cd sunat-platform
```

2. **Instalar dependencias** (ya instaladas):
```bash
npm install
```

3. **Ejecutar en modo desarrollo**:
```bash
npm run dev
```

4. **Abrir en el navegador**:
```
http://localhost:3000
```

## 📊 Datos de Demostración

El sistema incluye datos mock realistas en `src/lib/mock-data.ts`:

- ✅ 6 comprobantes de compras (facturas, notas de crédito)
- ✅ 4 comprobantes de ventas
- ✅ 7 alertas de diferentes tipos
- ✅ KPIs calculados
- ✅ Datos de gráficos (ventas/compras mensuales, flujo de caja)
- ✅ Top proveedores y clientes
- ✅ Cuentas por cobrar y pagar
- ✅ Distribución de documentos

## 🎨 Componentes UI Personalizados

Todos los componentes están construidos con **shadcn/ui** y personalizados para el tema de la aplicación:

- `Badge`: Con variantes para estados (success, warning, error, info)
- `Button`: Múltiples variantes y tamaños
- `Card`: Contenedores con header, content y footer
- `Dialog`: Modales para detalles
- `DropdownMenu`: Menús desplegables
- `Input`: Campos de entrada estilizados
- `Select`: Selectores personalizados
- `Tabs`: Navegación por pestañas
- `Progress`: Barras de progreso
- `Avatar`: Avatares de usuario
- `Separator`: Separadores visuales
- `ScrollArea`: Áreas con scroll personalizado

## 🔧 Próximos Pasos para Producción

### Backend y Base de Datos

1. **Configurar Prisma**:
```bash
npm install prisma @prisma/client
npx prisma init
```

2. **Definir el schema** en `prisma/schema.prisma`:
```prisma
model Company {
  id              String   @id @default(cuid())
  ruc             String   @unique
  razonSocial     String
  nombreComercial String?
  sector          String
  plan            String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  users           User[]
  comprobantes    Comprobante[]
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  nombre    String
  rol       String
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  createdAt DateTime @default(now())
}

model Comprobante {
  id                    String   @id @default(cuid())
  tipo                  String
  serie                 String
  numero                String
  fechaEmision          DateTime
  fechaVencimiento      DateTime?
  rucEmisor             String
  razonSocialEmisor     String
  rucReceptor           String
  razonSocialReceptor   String
  moneda                String
  subtotal              Float
  igv                   Float
  total                 Float
  estado                String
  tieneXML              Boolean  @default(false)
  tienePDF              Boolean  @default(false)
  tieneCDR              Boolean  @default(false)
  afectoDetraccion      Boolean  @default(false)
  porcentajeDetraccion  Float?
  montoDetraccion       Float?
  estadoDetraccion      String?
  observaciones         String?
  companyId             String
  company               Company  @relation(fields: [companyId], references: [id])
  items                 ComprobanteItem[]
  createdAt             DateTime @default(now())
  
  @@index([companyId, fechaEmision])
  @@index([serie, numero])
}

model ComprobanteItem {
  id              String      @id @default(cuid())
  comprobanteId   String
  comprobante     Comprobante @relation(fields: [comprobanteId], references: [id])
  descripcion     String
  cantidad        Float
  unidad          String
  precioUnitario  Float
  subtotal        Float
  igv             Float
  total           Float
}
```

3. **Migrar la base de datos**:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### API Routes

Crear API routes en `src/app/api/`:

- `/api/comprobantes` - CRUD de comprobantes
- `/api/sunat/download` - Integración con SUNAT
- `/api/reportes/generate` - Generación de reportes
- `/api/ia/query` - Endpoint para el copiloto IA

### Autenticación

Implementar con **NextAuth.js**:

```bash
npm install next-auth
```

### Integración SUNAT

1. Implementar cliente SOAP para servicios SUNAT
2. Configurar certificados digitales
3. Implementar descarga de XML/CDR/PDF
4. Validación de comprobantes

### Almacenamiento de Archivos

Configurar S3 o similar para almacenar XML, PDF, CDR:

```bash
npm install @aws-sdk/client-s3
```

### IA y Análisis

Integrar OpenAI o similar para el Copiloto IA:

```bash
npm install openai
```

## 🎯 Características Destacadas

### 1. Arquitectura Escalable
- Código modular y mantenible
- Componentes reutilizables
- Separación clara de responsabilidades
- Preparado para crecer sin refactorizar

### 2. UX Premium
- Diseño moderno y profesional
- Animaciones suaves
- Feedback visual inmediato
- Navegación intuitiva

### 3. Performance
- Server Components de Next.js 15
- Optimización de imágenes automática
- Code splitting
- Lazy loading

### 4. Datos Realistas
- Mock data completo y coherente
- Casos de uso reales
- Estados variados (aceptado, observado, pendiente)
- Documentos con y sin archivos

## 📝 Notas Importantes

- ✅ **Todos los módulos principales están implementados**
- ✅ **UI completamente funcional con datos demo**
- ✅ **Diseño responsive y moderno**
- ✅ **Componentes reutilizables y bien estructurados**
- ⚠️ **Backend pendiente de implementación**
- ⚠️ **Integración real con SUNAT pendiente**
- ⚠️ **Autenticación pendiente**

## 🤝 Contribución

Este es un proyecto base listo para ser extendido. Las áreas prioritarias son:

1. Implementación del backend con Prisma
2. Integración con servicios SUNAT
3. Sistema de autenticación robusto
4. Almacenamiento de archivos
5. Integración de IA real

## 📄 Licencia

Proyecto privado - Todos los derechos reservados

---

**Desarrollado con ❤️ usando Next.js, React, TypeScript y Tailwind CSS**
