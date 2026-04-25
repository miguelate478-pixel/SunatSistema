// ============================================================
// MOCK DATA - Plataforma Inteligente de Control SUNAT
// ============================================================

export type DocumentStatus = "ACEPTADO" | "RECHAZADO" | "PENDIENTE" | "ANULADO" | "OBSERVADO";
export type DocumentType = "FACTURA" | "BOLETA" | "NOTA_CREDITO" | "NOTA_DEBITO" | "RECIBO";
export type UserRole = "SUPER_ADMIN" | "ADMIN_EMPRESA" | "CONTABILIDAD" | "TESORERIA" | "GERENCIA" | "AUDITOR";

export interface Company {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  logo?: string;
  sector: string;
  plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
}

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  empresa: Company;
  avatar?: string;
}

export interface DocumentItem {
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
  igv: number;
  total: number;
}

export interface Comprobante {
  id: string;
  tipo: DocumentType;
  serie: string;
  numero: string;
  fechaEmision: string;
  fechaVencimiento?: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  rucReceptor: string;
  razonSocialReceptor: string;
  moneda: "PEN" | "USD";
  subtotal: number;
  igv: number;
  total: number;
  estado: DocumentStatus;
  tieneXML: boolean;
  tienePDF: boolean;
  tieneCDR: boolean;
  afectoDetraccion: boolean;
  porcentajeDetraccion?: number;
  montoDetraccion?: number;
  estadoDetraccion?: "PAGADO" | "PENDIENTE" | "VENCIDO";
  items: DocumentItem[];
  observaciones?: string;
  empresaId: string;
}

export interface AlertaItem {
  id: string;
  tipo: "ERROR" | "WARNING" | "INFO" | "SUCCESS";
  categoria: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  leida: boolean;
  accion?: string;
  empresaId: string;
}

export interface KPIData {
  comprasMes: number;
  comprasMesAnterior: number;
  ventasMes: number;
  ventasMesAnterior: number;
  documentosDescargados: number;
  xmlFaltantes: number;
  pdfFaltantes: number;
  cdrFaltantes: number;
  facturasObservadas: number;
  detracciones: number;
  detraccionesPendientes: number;
  cuentasCobrar: number;
  cuentasPagar: number;
  impuestoProximo: number;
  diasParaImpuesto: number;
}

// ============================================================
// EMPRESA DEMO
// ============================================================
export const empresaDemo: Company = {
  id: "emp-001",
  ruc: "20610169849",
  razonSocial: "CORPORACIÓN ANDINA S.A.C.",
  nombreComercial: "CorpAndina",
  sector: "Comercio",
  plan: "PROFESSIONAL",
};

export const usuarioDemo: User = {
  id: "usr-001",
  nombre: "Carlos Mendoza",
  email: "carlos.mendoza@corpandina.com",
  rol: "ADMIN_EMPRESA",
  empresa: empresaDemo,
};

// ============================================================
// KPIs DASHBOARD
// ============================================================
export const kpiData: KPIData = {
  comprasMes: 485320.5,
  comprasMesAnterior: 412800.0,
  ventasMes: 623450.8,
  ventasMesAnterior: 589200.0,
  documentosDescargados: 342,
  xmlFaltantes: 8,
  pdfFaltantes: 12,
  cdrFaltantes: 5,
  facturasObservadas: 14,
  detracciones: 23,
  detraccionesPendientes: 7,
  cuentasCobrar: 198450.0,
  cuentasPagar: 134200.0,
  impuestoProximo: 45320.0,
  diasParaImpuesto: 8,
};

// ============================================================
// COMPROBANTES DE COMPRAS
// ============================================================
export const comprobantesCompras: Comprobante[] = [
  {
    id: "comp-001",
    tipo: "FACTURA",
    serie: "F001",
    numero: "00012345",
    fechaEmision: "2024-04-15",
    fechaVencimiento: "2024-05-15",
    rucEmisor: "20100070970",
    razonSocialEmisor: "DISTRIBUIDORA NORTE S.A.C.",
    rucReceptor: "20610169849",
    razonSocialReceptor: "CORPORACIÓN ANDINA S.A.C.",
    moneda: "PEN",
    subtotal: 8474.58,
    igv: 1525.42,
    total: 10000.0,
    estado: "ACEPTADO",
    tieneXML: true,
    tienePDF: true,
    tieneCDR: true,
    afectoDetraccion: true,
    porcentajeDetraccion: 12,
    montoDetraccion: 1200.0,
    estadoDetraccion: "PAGADO",
    empresaId: "emp-001",
    items: [
      { descripcion: "LAPTOP DELL INSPIRON 15 3000", cantidad: 5, unidad: "UND", precioUnitario: 1694.92, subtotal: 8474.58, igv: 1525.42, total: 10000.0 },
    ],
  },
  {
    id: "comp-002",
    tipo: "FACTURA",
    serie: "F001",
    numero: "00012346",
    fechaEmision: "2024-04-16",
    fechaVencimiento: "2024-05-16",
    rucEmisor: "20503840121",
    razonSocialEmisor: "SUMINISTROS TECH PERU S.A.",
    rucReceptor: "20610169849",
    razonSocialReceptor: "CORPORACIÓN ANDINA S.A.C.",
    moneda: "PEN",
    subtotal: 4237.29,
    igv: 762.71,
    total: 5000.0,
    estado: "ACEPTADO",
    tieneXML: true,
    tienePDF: false,
    tieneCDR: true,
    afectoDetraccion: false,
    empresaId: "emp-001",
    observaciones: "PDF pendiente de descarga",
    items: [
      { descripcion: "MONITOR LG 27 PULGADAS 4K", cantidad: 3, unidad: "UND", precioUnitario: 847.46, subtotal: 2542.37, igv: 457.63, total: 3000.0 },
      { descripcion: "TECLADO MECÁNICO LOGITECH G915", cantidad: 5, unidad: "UND", precioUnitario: 338.98, subtotal: 1694.92, igv: 305.08, total: 2000.0 },
    ],
  },
  {
    id: "comp-003",
    tipo: "FACTURA",
    serie: "F001",
    numero: "00012347",
    fechaEmision: "2024-04-17",
    rucEmisor: "20601234567",
    razonSocialEmisor: "IMPORTACIONES GLOBALES E.I.R.L.",
    rucReceptor: "20610169849",
    razonSocialReceptor: "CORPORACIÓN ANDINA S.A.C.",
    moneda: "USD",
    subtotal: 6779.66,
    igv: 1220.34,
    total: 8000.0,
    estado: "OBSERVADO",
    tieneXML: true,
    tienePDF: true,
    tieneCDR: false,
    afectoDetraccion: true,
    porcentajeDetraccion: 10,
    montoDetraccion: 800.0,
    estadoDetraccion: "PENDIENTE",
    empresaId: "emp-001",
    observaciones: "CDR no descargado. Detracción pendiente de pago.",
    items: [
      { descripcion: "SERVIDOR HP PROLIANT DL380 GEN10", cantidad: 1, unidad: "UND", precioUnitario: 6779.66, subtotal: 6779.66, igv: 1220.34, total: 8000.0 },
    ],
  },
  {
    id: "comp-004",
    tipo: "FACTURA",
    serie: "E001",
    numero: "00001234",
    fechaEmision: "2024-04-18",
    fechaVencimiento: "2024-05-18",
    rucEmisor: "20100128218",
    razonSocialEmisor: "TELEFÓNICA DEL PERÚ S.A.A.",
    rucReceptor: "20610169849",
    razonSocialReceptor: "CORPORACIÓN ANDINA S.A.C.",
    moneda: "PEN",
    subtotal: 1271.19,
    igv: 228.81,
    total: 1500.0,
    estado: "ACEPTADO",
    tieneXML: true,
    tienePDF: true,
    tieneCDR: true,
    afectoDetraccion: false,
    empresaId: "emp-001",
    items: [
      { descripcion: "SERVICIO INTERNET EMPRESARIAL 200MB", cantidad: 1, unidad: "MES", precioUnitario: 847.46, subtotal: 847.46, igv: 152.54, total: 1000.0 },
      { descripcion: "SERVICIO TELEFONÍA FIJA CORPORATIVA", cantidad: 1, unidad: "MES", precioUnitario: 423.73, subtotal: 423.73, igv: 76.27, total: 500.0 },
    ],
  },
  {
    id: "comp-005",
    tipo: "NOTA_CREDITO",
    serie: "F001",
    numero: "00000234",
    fechaEmision: "2024-04-19",
    rucEmisor: "20100070970",
    razonSocialEmisor: "DISTRIBUIDORA NORTE S.A.C.",
    rucReceptor: "20610169849",
    razonSocialReceptor: "CORPORACIÓN ANDINA S.A.C.",
    moneda: "PEN",
    subtotal: -847.46,
    igv: -152.54,
    total: -1000.0,
    estado: "ACEPTADO",
    tieneXML: true,
    tienePDF: true,
    tieneCDR: true,
    afectoDetraccion: false,
    empresaId: "emp-001",
    items: [
      { descripcion: "DEVOLUCIÓN PARCIAL - LAPTOP DELL (1 UND)", cantidad: 1, unidad: "UND", precioUnitario: -847.46, subtotal: -847.46, igv: -152.54, total: -1000.0 },
    ],
  },
  {
    id: "comp-006",
    tipo: "FACTURA",
    serie: "F001",
    numero: "00012348",
    fechaEmision: "2024-04-20",
    fechaVencimiento: "2024-05-20",
    rucEmisor: "20456789012",
    razonSocialEmisor: "CONSTRUCTORA LIMA S.A.C.",
    rucReceptor: "20610169849",
    razonSocialReceptor: "CORPORACIÓN ANDINA S.A.C.",
    moneda: "PEN",
    subtotal: 25423.73,
    igv: 4576.27,
    total: 30000.0,
    estado: "PENDIENTE",
    tieneXML: false,
    tienePDF: false,
    tieneCDR: false,
    afectoDetraccion: true,
    porcentajeDetraccion: 4,
    montoDetraccion: 1200.0,
    estadoDetraccion: "PENDIENTE",
    empresaId: "emp-001",
    observaciones: "XML, PDF y CDR pendientes de descarga. Detracción no pagada.",
    items: [
      { descripcion: "SERVICIO DE CONSTRUCCIÓN OFICINAS PISO 3", cantidad: 1, unidad: "SRV", precioUnitario: 25423.73, subtotal: 25423.73, igv: 4576.27, total: 30000.0 },
    ],
  },
];

// ============================================================
// COMPROBANTES DE VENTAS
// ============================================================
export const comprobantesVentas: Comprobante[] = [
  {
    id: "vta-001",
    tipo: "FACTURA",
    serie: "F001",
    numero: "00045678",
    fechaEmision: "2024-04-15",
    fechaVencimiento: "2024-05-15",
    rucEmisor: "20610169849",
    razonSocialEmisor: "CORPORACIÓN ANDINA S.A.C.",
    rucReceptor: "20301234567",
    razonSocialReceptor: "MINERA ANDAHUAYLAS S.A.",
    moneda: "PEN",
    subtotal: 16949.15,
    igv: 3050.85,
    total: 20000.0,
    estado: "ACEPTADO",
    tieneXML: true,
    tienePDF: true,
    tieneCDR: true,
    afectoDetraccion: true,
    porcentajeDetraccion: 10,
    montoDetraccion: 2000.0,
    estadoDetraccion: "PAGADO",
    empresaId: "emp-001",
    items: [
      { descripcion: "EQUIPOS DE CÓMPUTO CORPORATIVO - LOTE 10", cantidad: 10, unidad: "UND", precioUnitario: 1694.92, subtotal: 16949.15, igv: 3050.85, total: 20000.0 },
    ],
  },
  {
    id: "vta-002",
    tipo: "FACTURA",
    serie: "F001",
    numero: "00045679",
    fechaEmision: "2024-04-16",
    fechaVencimiento: "2024-05-16",
    rucEmisor: "20610169849",
    razonSocialEmisor: "CORPORACIÓN ANDINA S.A.C.",
    rucReceptor: "20456123789",
    razonSocialReceptor: "GRUPO EMPRESARIAL NORTE S.A.C.",
    moneda: "PEN",
    subtotal: 12711.86,
    igv: 2288.14,
    total: 15000.0,
    estado: "ACEPTADO",
    tieneXML: true,
    tienePDF: true,
    tieneCDR: true,
    afectoDetraccion: false,
    empresaId: "emp-001",
    items: [
      { descripcion: "SERVICIO DE CONSULTORÍA TI - ABRIL 2024", cantidad: 1, unidad: "SRV", precioUnitario: 12711.86, subtotal: 12711.86, igv: 2288.14, total: 15000.0 },
    ],
  },
  {
    id: "vta-003",
    tipo: "BOLETA",
    serie: "B001",
    numero: "00123456",
    fechaEmision: "2024-04-17",
    rucEmisor: "20610169849",
    razonSocialEmisor: "CORPORACIÓN ANDINA S.A.C.",
    rucReceptor: "10456789012",
    razonSocialReceptor: "JUAN CARLOS QUISPE MAMANI",
    moneda: "PEN",
    subtotal: 423.73,
    igv: 76.27,
    total: 500.0,
    estado: "ACEPTADO",
    tieneXML: true,
    tienePDF: true,
    tieneCDR: true,
    afectoDetraccion: false,
    empresaId: "emp-001",
    items: [
      { descripcion: "MOUSE INALÁMBRICO LOGITECH MX MASTER 3", cantidad: 2, unidad: "UND", precioUnitario: 211.86, subtotal: 423.73, igv: 76.27, total: 500.0 },
    ],
  },
  {
    id: "vta-004",
    tipo: "FACTURA",
    serie: "F001",
    numero: "00045680",
    fechaEmision: "2024-04-18",
    fechaVencimiento: "2024-06-18",
    rucEmisor: "20610169849",
    razonSocialEmisor: "CORPORACIÓN ANDINA S.A.C.",
    rucReceptor: "20789456123",
    razonSocialReceptor: "BANCO CONTINENTAL S.A.",
    moneda: "USD",
    subtotal: 42372.88,
    igv: 7627.12,
    total: 50000.0,
    estado: "ACEPTADO",
    tieneXML: true,
    tienePDF: true,
    tieneCDR: true,
    afectoDetraccion: true,
    porcentajeDetraccion: 12,
    montoDetraccion: 6000.0,
    estadoDetraccion: "PENDIENTE",
    empresaId: "emp-001",
    items: [
      { descripcion: "IMPLEMENTACIÓN SISTEMA ERP MÓDULO FINANCIERO", cantidad: 1, unidad: "SRV", precioUnitario: 42372.88, subtotal: 42372.88, igv: 7627.12, total: 50000.0 },
    ],
  },
];

// ============================================================
// ALERTAS
// ============================================================
export const alertas: AlertaItem[] = [
  {
    id: "alr-001",
    tipo: "ERROR",
    categoria: "DOCUMENTOS",
    titulo: "XML faltante detectado",
    descripcion: "La factura F001-00012348 de CONSTRUCTORA LIMA S.A.C. no tiene XML descargado.",
    fecha: "2024-04-20T09:15:00",
    leida: false,
    accion: "Descargar XML",
    empresaId: "emp-001",
  },
  {
    id: "alr-002",
    tipo: "WARNING",
    categoria: "DETRACCIONES",
    titulo: "Detracción próxima a vencer",
    descripcion: "La detracción de F001-00012347 por S/ 800.00 vence en 3 días.",
    fecha: "2024-04-20T08:30:00",
    leida: false,
    accion: "Ver detalle",
    empresaId: "emp-001",
  },
  {
    id: "alr-003",
    tipo: "WARNING",
    categoria: "IMPUESTOS",
    titulo: "Declaración IGV próxima",
    descripcion: "La declaración mensual de IGV vence en 8 días. Monto estimado: S/ 45,320.00",
    fecha: "2024-04-20T08:00:00",
    leida: false,
    accion: "Ver reporte",
    empresaId: "emp-001",
  },
  {
    id: "alr-004",
    tipo: "ERROR",
    categoria: "DOCUMENTOS",
    titulo: "CDR no descargado",
    descripcion: "8 comprobantes tienen CDR pendiente de descarga este mes.",
    fecha: "2024-04-19T16:45:00",
    leida: false,
    accion: "Descargar CDR",
    empresaId: "emp-001",
  },
  {
    id: "alr-005",
    tipo: "INFO",
    categoria: "CUENTAS",
    titulo: "Factura por cobrar vencida",
    descripcion: "La factura F001-00045678 de MINERA ANDAHUAYLAS S.A. venció hace 5 días.",
    fecha: "2024-04-19T10:00:00",
    leida: true,
    accion: "Ver CxC",
    empresaId: "emp-001",
  },
  {
    id: "alr-006",
    tipo: "WARNING",
    categoria: "INCONSISTENCIAS",
    titulo: "Monto inusual detectado",
    descripcion: "La factura F001-00012347 tiene un monto 340% superior al promedio del proveedor.",
    fecha: "2024-04-18T14:20:00",
    leida: true,
    accion: "Revisar",
    empresaId: "emp-001",
  },
  {
    id: "alr-007",
    tipo: "SUCCESS",
    categoria: "SUNAT",
    titulo: "Sincronización completada",
    descripcion: "Se descargaron 47 comprobantes nuevos de SUNAT exitosamente.",
    fecha: "2024-04-18T09:00:00",
    leida: true,
    empresaId: "emp-001",
  },
];

// ============================================================
// DATOS PARA GRÁFICOS
// ============================================================
export const ventasComprasMensuales = [
  { mes: "Oct", ventas: 420000, compras: 310000 },
  { mes: "Nov", ventas: 480000, compras: 350000 },
  { mes: "Dic", ventas: 620000, compras: 480000 },
  { mes: "Ene", ventas: 390000, compras: 290000 },
  { mes: "Feb", ventas: 450000, compras: 330000 },
  { mes: "Mar", ventas: 589200, compras: 412800 },
  { mes: "Abr", ventas: 623450, compras: 485320 },
];

export const flujoCajaSemanal = [
  { semana: "S1", ingresos: 145000, egresos: 98000, neto: 47000 },
  { semana: "S2", ingresos: 168000, egresos: 125000, neto: 43000 },
  { semana: "S3", ingresos: 132000, egresos: 145000, neto: -13000 },
  { semana: "S4", ingresos: 178450, egresos: 117320, neto: 61130 },
];

export const topProveedores = [
  { nombre: "DISTRIBUIDORA NORTE S.A.C.", monto: 85000, facturas: 12, ruc: "20100070970" },
  { nombre: "SUMINISTROS TECH PERU S.A.", monto: 62000, facturas: 8, ruc: "20503840121" },
  { nombre: "CONSTRUCTORA LIMA S.A.C.", monto: 58000, facturas: 5, ruc: "20456789012" },
  { nombre: "TELEFÓNICA DEL PERÚ S.A.A.", monto: 18000, facturas: 12, ruc: "20100128218" },
  { nombre: "IMPORTACIONES GLOBALES E.I.R.L.", monto: 45000, facturas: 6, ruc: "20601234567" },
];

export const topClientes = [
  { nombre: "BANCO CONTINENTAL S.A.", monto: 150000, facturas: 3, ruc: "20789456123" },
  { nombre: "MINERA ANDAHUAYLAS S.A.", monto: 120000, facturas: 6, ruc: "20301234567" },
  { nombre: "GRUPO EMPRESARIAL NORTE S.A.C.", monto: 95000, facturas: 8, ruc: "20456123789" },
  { nombre: "CONSTRUCTORA INCA S.A.", monto: 78000, facturas: 4, ruc: "20567890123" },
  { nombre: "RETAIL PERU S.A.C.", monto: 45000, facturas: 15, ruc: "20678901234" },
];

export const distribucionDocumentos = [
  { tipo: "Facturas", cantidad: 245, porcentaje: 71.6 },
  { tipo: "Boletas", cantidad: 67, porcentaje: 19.6 },
  { tipo: "N. Crédito", cantidad: 18, porcentaje: 5.3 },
  { tipo: "N. Débito", cantidad: 12, porcentaje: 3.5 },
];

// ============================================================
// CUENTAS POR COBRAR
// ============================================================
export const cuentasCobrar = [
  { id: "cxc-001", cliente: "BANCO CONTINENTAL S.A.", ruc: "20789456123", documento: "F001-00045680", monto: 50000, moneda: "USD", fechaEmision: "2024-04-18", fechaVencimiento: "2024-06-18", diasVencimiento: 59, estado: "VIGENTE" },
  { id: "cxc-002", cliente: "MINERA ANDAHUAYLAS S.A.", ruc: "20301234567", documento: "F001-00045678", monto: 20000, moneda: "PEN", fechaEmision: "2024-04-15", fechaVencimiento: "2024-05-15", diasVencimiento: 25, estado: "VIGENTE" },
  { id: "cxc-003", cliente: "GRUPO EMPRESARIAL NORTE S.A.C.", ruc: "20456123789", documento: "F001-00045679", monto: 15000, moneda: "PEN", fechaEmision: "2024-04-16", fechaVencimiento: "2024-05-16", diasVencimiento: 26, estado: "VIGENTE" },
  { id: "cxc-004", cliente: "CONSTRUCTORA INCA S.A.", ruc: "20567890123", documento: "F001-00044123", monto: 35000, moneda: "PEN", fechaEmision: "2024-03-10", fechaVencimiento: "2024-04-10", diasVencimiento: -10, estado: "VENCIDO" },
  { id: "cxc-005", cliente: "RETAIL PERU S.A.C.", ruc: "20678901234", documento: "F001-00044456", monto: 12500, moneda: "PEN", fechaEmision: "2024-03-20", fechaVencimiento: "2024-04-20", diasVencimiento: 0, estado: "VENCE_HOY" },
];

// ============================================================
// CUENTAS POR PAGAR
// ============================================================
export const cuentasPagar = [
  { id: "cxp-001", proveedor: "DISTRIBUIDORA NORTE S.A.C.", ruc: "20100070970", documento: "F001-00012345", monto: 10000, moneda: "PEN", fechaEmision: "2024-04-15", fechaVencimiento: "2024-05-15", diasVencimiento: 25, estado: "VIGENTE" },
  { id: "cxp-002", proveedor: "CONSTRUCTORA LIMA S.A.C.", ruc: "20456789012", documento: "F001-00012348", monto: 30000, moneda: "PEN", fechaEmision: "2024-04-20", fechaVencimiento: "2024-05-20", diasVencimiento: 30, estado: "VIGENTE" },
  { id: "cxp-003", proveedor: "IMPORTACIONES GLOBALES E.I.R.L.", ruc: "20601234567", documento: "F001-00012347", monto: 8000, moneda: "USD", fechaEmision: "2024-04-17", fechaVencimiento: "2024-05-17", diasVencimiento: 27, estado: "VIGENTE" },
  { id: "cxp-004", proveedor: "SUMINISTROS TECH PERU S.A.", ruc: "20503840121", documento: "F001-00011234", monto: 15000, moneda: "PEN", fechaEmision: "2024-03-15", fechaVencimiento: "2024-04-15", diasVencimiento: -5, estado: "VENCIDO" },
];

