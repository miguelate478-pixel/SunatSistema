# 🚀 Inicio Rápido

## ¡Bienvenido a la Plataforma de Control SUNAT!

Este documento te guiará para tener el sistema funcionando en menos de 5 minutos.

## ✅ Prerrequisitos

Asegúrate de tener instalado:
- **Node.js 18+** (verifica con `node --version`)
- **npm** o **yarn** (verifica con `npm --version`)

## 📦 Paso 1: Instalar Dependencias

Las dependencias ya están instaladas, pero si necesitas reinstalar:

```bash
cd sunat-platform
npm install
```

## 🎯 Paso 2: Ejecutar en Desarrollo

```bash
npm run dev
```

El servidor se iniciará en: **http://localhost:3000**

## 🌐 Paso 3: Explorar la Aplicación

### Navegación Principal

1. **Dashboard** (`/dashboard`)
   - Vista general con KPIs
   - Gráficos de ventas vs compras
   - Alertas críticas
   - Últimos comprobantes

2. **Compras** (`/compras`)
   - Tabla de comprobantes de compra
   - Filtros por tipo, estado, proveedor
   - Vista detallada de cada comprobante
   - Control de archivos XML/PDF/CDR

3. **Ventas** (`/ventas`)
   - Registro de comprobantes emitidos
   - Análisis por cliente
   - Estados SUNAT

4. **Detracciones** (`/detracciones`)
   - Control SPOT
   - Estados: Pagado, Pendiente, Vencido
   - Cálculo automático de montos

5. **Documentos** (`/documentos`)
   - Repositorio organizado
   - Búsqueda avanzada
   - Carpetas automáticas

6. **Alertas** (`/alertas`)
   - Notificaciones críticas
   - Filtros por tipo
   - Acciones rápidas

7. **Cuentas por Cobrar** (`/cuentas-cobrar`)
   - Cartera de clientes
   - Antigüedad de saldos
   - Facturas vencidas

8. **Cuentas por Pagar** (`/cuentas-pagar`)
   - Obligaciones con proveedores
   - Cronograma de pagos

9. **Reportes** (`/reportes`)
   - Generación de reportes
   - Múltiples formatos
   - Reportes predefinidos

10. **Copiloto IA** (`/ia`)
    - Asistente inteligente
    - Consultas en lenguaje natural
    - Insights automáticos

## 🎨 Características Destacadas

### Sidebar Colapsable
- Haz clic en el botón `<` para colapsar
- Perfecto para pantallas pequeñas
- Mantiene la funcionalidad completa

### Búsqueda Global
- Busca por RUC, serie, proveedor
- Resultados en tiempo real
- Disponible en la barra superior

### Filtros Avanzados
- Filtra por tipo de documento
- Filtra por estado
- Filtra por período
- Combina múltiples filtros

### Vista Detallada
- Haz clic en el ícono 👁️ en cualquier comprobante
- Ve todos los ítems del documento
- Descarga archivos individuales
- Información de detracción

### Notificaciones
- Badge rojo en el ícono 🔔
- Alertas no leídas destacadas
- Acciones rápidas desde el dropdown

## 📊 Datos de Demostración

El sistema incluye datos realistas:

### Comprobantes
- **6 comprobantes de compras**
  - Facturas de diferentes proveedores
  - Notas de crédito
  - Con y sin detracción
  - Estados variados

- **4 comprobantes de ventas**
  - Facturas a clientes
  - Boletas
  - Diferentes monedas (PEN/USD)

### Alertas
- 7 alertas de diferentes tipos
- Críticas, advertencias, información
- Categorizadas por módulo

### KPIs
- Compras del mes: S/ 485,320.50
- Ventas del mes: S/ 623,450.80
- Documentos descargados: 342
- Detracciones pendientes: 7

## 🔧 Comandos Útiles

### Desarrollo
```bash
npm run dev          # Inicia servidor de desarrollo
npm run build        # Construye para producción
npm run start        # Inicia servidor de producción
npm run lint         # Ejecuta el linter
```

### Verificar Build
```bash
npm run build
```
Debe completarse sin errores.

## 🎯 Próximos Pasos

### Para Desarrolladores

1. **Explorar el código**
   - Revisa `src/app/(dashboard)` para las páginas
   - Revisa `src/components` para los componentes
   - Revisa `src/lib/mock-data.ts` para los datos

2. **Personalizar**
   - Modifica colores en `tailwind.config.ts`
   - Ajusta datos en `mock-data.ts`
   - Agrega nuevos componentes en `components/`

3. **Implementar Backend**
   - Sigue las instrucciones en `README.md`
   - Configura Prisma
   - Crea API routes

### Para Product Managers

1. **Evaluar funcionalidades**
   - Navega por todos los módulos
   - Prueba los filtros y búsquedas
   - Revisa los reportes disponibles

2. **Identificar mejoras**
   - ¿Qué funcionalidades faltan?
   - ¿Qué flujos se pueden optimizar?
   - ¿Qué reportes adicionales se necesitan?

3. **Planificar roadmap**
   - Priorizar integraciones
   - Definir MVP para producción
   - Establecer métricas de éxito

### Para Diseñadores

1. **Revisar UX**
   - Flujos de navegación
   - Jerarquía visual
   - Feedback de acciones

2. **Evaluar UI**
   - Consistencia de componentes
   - Espaciado y tipografía
   - Paleta de colores

3. **Proponer mejoras**
   - Animaciones adicionales
   - Micro-interacciones
   - Responsive design

## 🐛 Solución de Problemas

### El servidor no inicia
```bash
# Limpia node_modules y reinstala
rm -rf node_modules
npm install
npm run dev
```

### Error de TypeScript
```bash
# Verifica la configuración
npx tsc --noEmit
```

### Error de build
```bash
# Limpia el cache de Next.js
rm -rf .next
npm run build
```

### Puerto 3000 ocupado
```bash
# Usa otro puerto
PORT=3001 npm run dev
```

## 📚 Recursos Adicionales

- **README.md**: Documentación completa
- **ARQUITECTURA.md**: Detalles técnicos
- **src/lib/mock-data.ts**: Estructura de datos
- **src/components/ui/**: Componentes base

## 💡 Tips

1. **Usa el Copiloto IA** para explorar funcionalidades
2. **Colapsa el sidebar** en pantallas pequeñas
3. **Filtra por estado** para encontrar documentos específicos
4. **Haz clic en las tarjetas KPI** para ver detalles
5. **Usa la búsqueda global** para encontrar rápido

## 🎉 ¡Listo!

Ya tienes todo funcionando. Explora, experimenta y construye algo increíble.

### ¿Preguntas?

- Revisa la documentación en `README.md`
- Explora el código fuente
- Consulta `ARQUITECTURA.md` para detalles técnicos

---

**¡Feliz desarrollo! 🚀**
