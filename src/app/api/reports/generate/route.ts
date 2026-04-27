import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { storage } from "@/lib/storage";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { audit, requestMeta } from "@/lib/audit";
import { z } from "zod";

const generateSchema = z.object({
  companyId: z.string().uuid(),
  tipo: z.enum(["compras", "ventas", "detracciones", "alertas", "cuentas_cobrar", "cuentas_pagar", "flujo_caja", "resumen_ejecutivo"]),
  formato: z.enum(["JSON", "CSV", "EXCEL"]).default("EXCEL"),
  fechaInicio: z.string().optional(),
  fechaFin: z.string().optional(),
});

// ── Data builders ──────────────────────────────────────────────────────────────

async function buildCompras(companyId: string, company: { ruc: string }, fechaInicio?: Date, fechaFin?: Date) {
  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      deletedAt: null,
      rucReceptor: company.ruc,
      ...(fechaInicio && fechaFin ? { fechaEmision: { gte: fechaInicio, lte: fechaFin } } : {}),
    },
    include: { detraction: true },
    orderBy: { fechaEmision: "desc" },
  });
  return vouchers.map((v) => ({
    serie: v.serie,
    numero: v.numero,
    tipo: v.tipo,
    fechaEmision: v.fechaEmision.toISOString().split("T")[0],
    rucProveedor: v.rucEmisor,
    proveedor: v.razonSocialEmisor,
    moneda: v.moneda,
    subtotal: Number(v.subtotal),
    igv: Number(v.igv),
    total: Number(v.total),
    estado: v.estado,
    tieneXML: v.tieneXML,
    tienePDF: v.tienePDF,
    tieneCDR: v.tieneCDR,
    detraccion: v.detraction ? { monto: Number(v.detraction.monto), estado: v.detraction.estado } : null,
  }));
}

async function buildVentas(companyId: string, company: { ruc: string }, fechaInicio?: Date, fechaFin?: Date) {
  const vouchers = await prisma.voucher.findMany({
    where: {
      companyId,
      deletedAt: null,
      rucEmisor: company.ruc,
      ...(fechaInicio && fechaFin ? { fechaEmision: { gte: fechaInicio, lte: fechaFin } } : {}),
    },
    orderBy: { fechaEmision: "desc" },
  });
  return vouchers.map((v) => ({
    serie: v.serie,
    numero: v.numero,
    tipo: v.tipo,
    fechaEmision: v.fechaEmision.toISOString().split("T")[0],
    rucCliente: v.rucReceptor,
    cliente: v.razonSocialReceptor,
    moneda: v.moneda,
    subtotal: Number(v.subtotal),
    igv: Number(v.igv),
    total: Number(v.total),
    estado: v.estado,
  }));
}

async function buildDetracciones(companyId: string) {
  const rows = await prisma.detraction.findMany({
    where: { voucher: { companyId } },
    include: { voucher: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((d) => ({
    serie: d.voucher.serie,
    numero: d.voucher.numero,
    proveedor: d.voucher.razonSocialEmisor,
    total: Number(d.voucher.total),
    porcentaje: Number(d.porcentaje),
    monto: Number(d.monto),
    estado: d.estado,
    fechaPago: d.fechaPago?.toISOString().split("T")[0] ?? null,
    numeroConstancia: d.numeroConstancia ?? null,
  }));
}

async function buildAlertas(companyId: string) {
  const rows = await prisma.alert.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((a) => ({
    tipo: a.tipo,
    categoria: a.categoria,
    titulo: a.titulo,
    descripcion: a.descripcion,
    leida: a.leida,
    fecha: a.createdAt.toISOString().split("T")[0],
  }));
}

async function buildCuentasCobrar(companyId: string) {
  const rows = await prisma.accountReceivable.findMany({ where: { companyId }, orderBy: { fechaVencimiento: "asc" } });
  const now = new Date();
  return rows.map((a) => ({
    cliente: a.cliente,
    ruc: a.ruc,
    documento: a.documento,
    monto: Number(a.monto),
    saldo: Number(a.saldo),
    moneda: a.moneda,
    fechaEmision: a.fechaEmision.toISOString().split("T")[0],
    fechaVencimiento: a.fechaVencimiento.toISOString().split("T")[0],
    diasVencimiento: Math.ceil((a.fechaVencimiento.getTime() - now.getTime()) / 86400000),
    estado: a.estado,
  }));
}

async function buildCuentasPagar(companyId: string) {
  const rows = await prisma.accountPayable.findMany({ where: { companyId }, orderBy: { fechaVencimiento: "asc" } });
  const now = new Date();
  return rows.map((a) => ({
    proveedor: a.proveedor,
    ruc: a.ruc,
    documento: a.documento,
    monto: Number(a.monto),
    saldo: Number(a.saldo),
    moneda: a.moneda,
    fechaEmision: a.fechaEmision.toISOString().split("T")[0],
    fechaVencimiento: a.fechaVencimiento.toISOString().split("T")[0],
    diasVencimiento: Math.ceil((a.fechaVencimiento.getTime() - now.getTime()) / 86400000),
    estado: a.estado,
  }));
}

async function buildFlujoCaja(companyId: string, company: { ruc: string }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 0), label: d.toLocaleDateString("es-PE", { month: "short", year: "2-digit" }) };
  });
  return Promise.all(months.map(async ({ start, end, label }) => {
    const [ingresos, egresos] = await Promise.all([
      prisma.voucher.aggregate({ where: { companyId, deletedAt: null, rucEmisor: company.ruc, fechaEmision: { gte: start, lte: end } }, _sum: { total: true } }),
      prisma.voucher.aggregate({ where: { companyId, deletedAt: null, rucReceptor: company.ruc, fechaEmision: { gte: start, lte: end } }, _sum: { total: true } }),
    ]);
    const ing = Number(ingresos._sum.total ?? 0);
    const egr = Number(egresos._sum.total ?? 0);
    return { periodo: label, ingresos: ing, egresos: egr, neto: ing - egr };
  }));
}

async function buildResumenEjecutivo(companyId: string, company: { ruc: string; razonSocial: string }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [compras, ventas, detracciones, alertas, cxc, cxp] = await Promise.all([
    prisma.voucher.aggregate({ where: { companyId, deletedAt: null, rucReceptor: company.ruc, fechaEmision: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    prisma.voucher.aggregate({ where: { companyId, deletedAt: null, rucEmisor: company.ruc, fechaEmision: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    prisma.detraction.count({ where: { voucher: { companyId }, estado: "PENDIENTE" } }),
    prisma.alert.count({ where: { companyId, deletedAt: null, leida: false } }),
    prisma.accountReceivable.aggregate({ where: { companyId }, _sum: { saldo: true } }),
    prisma.accountPayable.aggregate({ where: { companyId }, _sum: { saldo: true } }),
  ]);
  return {
    empresa: company.razonSocial,
    periodo: monthStart.toLocaleDateString("es-PE", { month: "long", year: "numeric" }),
    comprasMes: { total: Number(compras._sum.total ?? 0), cantidad: compras._count },
    ventasMes: { total: Number(ventas._sum.total ?? 0), cantidad: ventas._count },
    detraccionesPendientes: detracciones,
    alertasNoLeidas: alertas,
    cuentasCobrar: Number(cxc._sum.saldo ?? 0),
    cuentasPagar: Number(cxp._sum.saldo ?? 0),
  };
}

// ── CSV helper ─────────────────────────────────────────────────────────────────
function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))];
  return lines.join("\n");
}

// ── Excel helper ───────────────────────────────────────────────────────────────
function toExcel(rows: Record<string, unknown>[], sheetName: string): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width columns
  const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
    wch: Math.max(key.length, ...rows.map((r) => String(r[key] ?? "").length).slice(0, 100)) + 2,
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Rate limit report generation
    const rl = await rateLimit(`report:${session.id}`, RATE_LIMITS.REPORT_GENERATE);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Demasiadas solicitudes de reporte. Espera un momento." },
        { status: 429 }
      );
    }
    const body = await request.json();
    const params = generateSchema.parse(body);

    const company = await prisma.company.findUnique({ where: { id: params.companyId } });
    if (!company) return NextResponse.json({ success: false, error: "Empresa no encontrada" }, { status: 404 });

    const fechaInicio = params.fechaInicio ? new Date(params.fechaInicio) : undefined;
    const fechaFin = params.fechaFin ? new Date(params.fechaFin) : undefined;

    // Create execution record
    const execution = await prisma.reportExecution.create({
      data: {
        companyId: params.companyId,
        tipo: params.tipo,
        formato: params.formato,
        parametros: { fechaInicio: params.fechaInicio, fechaFin: params.fechaFin },
        estado: "PROCESSING",
      },
    });

    // Build data
    let data: unknown;
    try {
      switch (params.tipo) {
        case "compras": data = await buildCompras(params.companyId, company, fechaInicio, fechaFin); break;
        case "ventas": data = await buildVentas(params.companyId, company, fechaInicio, fechaFin); break;
        case "detracciones": data = await buildDetracciones(params.companyId); break;
        case "alertas": data = await buildAlertas(params.companyId); break;
        case "cuentas_cobrar": data = await buildCuentasCobrar(params.companyId); break;
        case "cuentas_pagar": data = await buildCuentasPagar(params.companyId); break;
        case "flujo_caja": data = await buildFlujoCaja(params.companyId, company); break;
        case "resumen_ejecutivo": data = await buildResumenEjecutivo(params.companyId, company); break;
        default: data = [];
      }
    } catch (err) {
      await prisma.reportExecution.update({ where: { id: execution.id }, data: { estado: "FAILED", errorMsg: String(err) } });
      throw err;
    }

    const rows = Array.isArray(data) ? data : [data];
    let content: string | Buffer;
    let ext: string;
    let mimeType: string;

    if (params.formato === "EXCEL") {
      content = toExcel(rows as Record<string, unknown>[], params.tipo);
      ext = "xlsx";
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (params.formato === "CSV") {
      content = toCSV(rows as Record<string, unknown>[]);
      ext = "csv";
      mimeType = "text/csv";
    } else {
      content = JSON.stringify(data, null, 2);
      ext = "json";
      mimeType = "application/json";
    }

    const filesize = typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.length;
    const filename = `${params.tipo}_${new Date().toISOString().split("T")[0]}.${ext}`;

    // Persist to storage
    const storageKey = storage.reportKey(params.companyId, execution.id, filename);
    await storage.upload({
      key: storageKey,
      content: typeof content === "string" ? content : content,
      mimeType,
      metadata: { companyId: params.companyId, tipo: params.tipo, formato: params.formato },
    });
    const storageUrl = storage.url(storageKey);

    await prisma.reportExecution.update({
      where: { id: execution.id },
      data: { estado: "COMPLETED", filesize, filepath: storageKey, storageUrl, completedAt: new Date() },
    });

    // Audit log
    audit({
      userId: session.id,
      companyId: params.companyId,
      action: "REPORT_GENERATE",
      entity: "ReportExecution",
      entityId: execution.id,
      changes: { tipo: params.tipo, formato: params.formato, filesize },
      ...requestMeta(request),
    });

    return NextResponse.json({
      success: true,
      data: {
        id: execution.id,
        tipo: params.tipo,
        formato: params.formato,
        estado: "COMPLETED",
        filesize,
        // For Excel: send as base64 so JSON can carry binary
        content: params.formato === "EXCEL"
          ? (content as Buffer).toString("base64")
          : content,
        contentEncoding: params.formato === "EXCEL" ? "base64" : "utf8",
        rows: rows.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al generar reporte";
    console.error("Report generate error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 400 });
  }
}
