import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { z } from "zod";

const querySchema = z.object({
  companyId: z.string().uuid(),
  message: z.string().min(1).max(500),
});

// ── Intent detection ───────────────────────────────────────────────────────────
function detectIntent(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("compra") || m.includes("proveedor") || m.includes("factura de compra")) return "compras";
  if (m.includes("venta") || m.includes("cliente") || m.includes("factura de venta")) return "ventas";
  if (m.includes("detraccion") || m.includes("detracción") || m.includes("spot")) return "detracciones";
  if (m.includes("alerta") || m.includes("critica") || m.includes("crítica") || m.includes("urgente")) return "alertas";
  if (m.includes("cobrar") || m.includes("cobro") || m.includes("cartera")) return "cuentas_cobrar";
  if (m.includes("pagar") || m.includes("pago") || m.includes("obligacion")) return "cuentas_pagar";
  if (m.includes("documento") || m.includes("xml") || m.includes("pdf") || m.includes("cdr") || m.includes("faltante")) return "documentos";
  if (m.includes("resumen") || m.includes("kpi") || m.includes("ejecutivo") || m.includes("dashboard")) return "resumen";
  return "general";
}

// ── Query handlers ─────────────────────────────────────────────────────────────
async function handleCompras(companyId: string, company: { ruc: string; razonSocial: string }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [mes, pendientes, top] = await Promise.all([
    prisma.voucher.aggregate({ where: { companyId, deletedAt: null, rucReceptor: company.ruc, fechaEmision: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    prisma.voucher.count({ where: { companyId, deletedAt: null, rucReceptor: company.ruc, estado: "PENDIENTE" } }),
    prisma.voucher.groupBy({ by: ["razonSocialEmisor"], where: { companyId, deletedAt: null, rucReceptor: company.ruc }, _sum: { total: true }, _count: true, orderBy: { _sum: { total: "desc" } }, take: 3 }),
  ]);
  const totalMes = Number(mes._sum.total ?? 0);
  const topStr = top.map((t, i) => `${i + 1}. ${t.razonSocialEmisor} — S/ ${Number(t._sum.total ?? 0).toLocaleString("es-PE")}`).join("\n");
  return `📦 **Resumen de Compras del Mes**\n\n• Total compras: **S/ ${totalMes.toLocaleString("es-PE")}** (${mes._count} comprobantes)\n• Comprobantes pendientes: **${pendientes}**\n\n**Top 3 Proveedores:**\n${topStr || "Sin datos"}`;
}

async function handleVentas(companyId: string, company: { ruc: string }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [mes, top] = await Promise.all([
    prisma.voucher.aggregate({ where: { companyId, deletedAt: null, rucEmisor: company.ruc, fechaEmision: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    prisma.voucher.groupBy({ by: ["razonSocialReceptor"], where: { companyId, deletedAt: null, rucEmisor: company.ruc }, _sum: { total: true }, orderBy: { _sum: { total: "desc" } }, take: 3 }),
  ]);
  const totalMes = Number(mes._sum.total ?? 0);
  const topStr = top.map((t, i) => `${i + 1}. ${t.razonSocialReceptor} — S/ ${Number(t._sum.total ?? 0).toLocaleString("es-PE")}`).join("\n");
  return `📈 **Resumen de Ventas del Mes**\n\n• Total ventas: **S/ ${totalMes.toLocaleString("es-PE")}** (${mes._count} comprobantes)\n\n**Top 3 Clientes:**\n${topStr || "Sin datos"}`;
}

async function handleDetracciones(companyId: string) {
  const [pendientes, vencidas, total] = await Promise.all([
    prisma.detraction.findMany({ where: { voucher: { companyId }, estado: "PENDIENTE" }, include: { voucher: true }, take: 5 }),
    prisma.detraction.count({ where: { voucher: { companyId }, estado: "VENCIDO" } }),
    prisma.detraction.aggregate({ where: { voucher: { companyId }, estado: "PENDIENTE" }, _sum: { monto: true } }),
  ]);
  const totalMonto = Number(total._sum.monto ?? 0);
  const lista = pendientes.map((d) => `• ${d.voucher.serie}-${d.voucher.numero} — S/ ${Number(d.monto).toLocaleString("es-PE")}`).join("\n");
  return `⚠️ **Detracciones Pendientes**\n\n• Cantidad pendiente: **${pendientes.length}** (${vencidas} vencidas)\n• Monto total pendiente: **S/ ${totalMonto.toLocaleString("es-PE")}**\n\n${lista || "Sin detracciones pendientes"}`;
}

async function handleAlertas(companyId: string) {
  const [criticas, warnings, total] = await Promise.all([
    prisma.alert.findMany({ where: { companyId, deletedAt: null, tipo: "ERROR", leida: false }, take: 5 }),
    prisma.alert.count({ where: { companyId, deletedAt: null, tipo: "WARNING", leida: false } }),
    prisma.alert.count({ where: { companyId, deletedAt: null, leida: false } }),
  ]);
  const lista = criticas.map((a) => `🔴 ${a.titulo}: ${a.descripcion}`).join("\n");
  return `🚨 **Alertas Críticas**\n\n• Total no leídas: **${total}** (${criticas.length} críticas, ${warnings} advertencias)\n\n${lista || "Sin alertas críticas activas"}`;
}

async function handleDocumentos(companyId: string) {
  const [sinXML, sinPDF, sinCDR, total] = await Promise.all([
    prisma.voucher.count({ where: { companyId, deletedAt: null, tieneXML: false } }),
    prisma.voucher.count({ where: { companyId, deletedAt: null, tienePDF: false } }),
    prisma.voucher.count({ where: { companyId, deletedAt: null, tieneCDR: false } }),
    prisma.voucher.count({ where: { companyId, deletedAt: null } }),
  ]);
  return `📁 **Estado de Documentos**\n\n• Total comprobantes: **${total}**\n• Sin XML: **${sinXML}** comprobantes\n• Sin PDF: **${sinPDF}** comprobantes\n• Sin CDR: **${sinCDR}** comprobantes\n\n${sinXML + sinPDF + sinCDR > 0 ? "💡 Usa el módulo de Descargas SUNAT para obtener los archivos faltantes." : "✅ Todos los documentos están completos."}`;
}

async function handleCuentasCobrar(companyId: string) {
  const now = new Date();
  const [vencidas, vigentes, total] = await Promise.all([
    prisma.accountReceivable.aggregate({ where: { companyId, estado: "VENCIDO" }, _sum: { saldo: true }, _count: true }),
    prisma.accountReceivable.aggregate({ where: { companyId, estado: "VIGENTE" }, _sum: { saldo: true }, _count: true }),
    prisma.accountReceivable.aggregate({ where: { companyId }, _sum: { saldo: true } }),
  ]);
  void now;
  return `💰 **Cuentas por Cobrar**\n\n• Total cartera: **S/ ${Number(total._sum.saldo ?? 0).toLocaleString("es-PE")}**\n• Vigentes: ${vigentes._count} facturas — S/ ${Number(vigentes._sum.saldo ?? 0).toLocaleString("es-PE")}\n• Vencidas: **${vencidas._count} facturas — S/ ${Number(vencidas._sum.saldo ?? 0).toLocaleString("es-PE")}**\n\n${vencidas._count > 0 ? "⚠️ Hay facturas vencidas que requieren gestión de cobranza urgente." : "✅ No hay facturas vencidas."}`;
}

async function handleCuentasPagar(companyId: string) {
  const [vencidas, vigentes, total] = await Promise.all([
    prisma.accountPayable.aggregate({ where: { companyId, estado: "VENCIDO" }, _sum: { saldo: true }, _count: true }),
    prisma.accountPayable.aggregate({ where: { companyId, estado: "VIGENTE" }, _sum: { saldo: true }, _count: true }),
    prisma.accountPayable.aggregate({ where: { companyId }, _sum: { saldo: true } }),
  ]);
  return `💳 **Cuentas por Pagar**\n\n• Total obligaciones: **S/ ${Number(total._sum.saldo ?? 0).toLocaleString("es-PE")}**\n• Vigentes: ${vigentes._count} facturas — S/ ${Number(vigentes._sum.saldo ?? 0).toLocaleString("es-PE")}\n• Vencidas: **${vencidas._count} facturas — S/ ${Number(vencidas._sum.saldo ?? 0).toLocaleString("es-PE")}**\n\n${vencidas._count > 0 ? "⚠️ Tienes facturas vencidas. Programa pagos urgentes para evitar penalidades." : "✅ Todas las obligaciones están al día."}`;
}

async function handleResumen(companyId: string, company: { ruc: string; razonSocial: string }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [compras, ventas, alertas, detracciones] = await Promise.all([
    prisma.voucher.aggregate({ where: { companyId, deletedAt: null, rucReceptor: company.ruc, fechaEmision: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    prisma.voucher.aggregate({ where: { companyId, deletedAt: null, rucEmisor: company.ruc, fechaEmision: { gte: monthStart } }, _sum: { total: true }, _count: true }),
    prisma.alert.count({ where: { companyId, deletedAt: null, leida: false } }),
    prisma.detraction.count({ where: { voucher: { companyId }, estado: "PENDIENTE" } }),
  ]);
  return `📊 **Resumen Ejecutivo — ${monthStart.toLocaleDateString("es-PE", { month: "long", year: "numeric" })}**\n\n**${company.razonSocial}**\n\n• Compras del mes: S/ ${Number(compras._sum.total ?? 0).toLocaleString("es-PE")} (${compras._count} docs)\n• Ventas del mes: S/ ${Number(ventas._sum.total ?? 0).toLocaleString("es-PE")} (${ventas._count} docs)\n• Alertas pendientes: ${alertas}\n• Detracciones por pagar: ${detracciones}`;
}

// ── Main handler ───────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Rate limit AI queries per user
    const rl = await rateLimit(`ai:${session.id}`, RATE_LIMITS.AI_QUERY);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Demasiadas consultas. Espera un momento e intenta nuevamente." },
        { status: 429 }
      );
    }
    const body = await request.json();
    const { companyId, message } = querySchema.parse(body);

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ success: false, error: "Empresa no encontrada" }, { status: 404 });

    const intent = detectIntent(message);
    let response: string;

    switch (intent) {
      case "compras": response = await handleCompras(companyId, company); break;
      case "ventas": response = await handleVentas(companyId, company); break;
      case "detracciones": response = await handleDetracciones(companyId); break;
      case "alertas": response = await handleAlertas(companyId); break;
      case "documentos": response = await handleDocumentos(companyId); break;
      case "cuentas_cobrar": response = await handleCuentasCobrar(companyId); break;
      case "cuentas_pagar": response = await handleCuentasPagar(companyId); break;
      case "resumen": response = await handleResumen(companyId, company); break;
      default:
        response = `Hola, soy tu Copiloto IA. Puedo ayudarte con:\n\n• Resumen de compras y ventas\n• Estado de detracciones\n• Alertas críticas\n• Documentos faltantes\n• Cuentas por cobrar y pagar\n• Resumen ejecutivo\n\n¿Sobre qué quieres consultar?`;
    }

    return NextResponse.json({ success: true, data: { response, intent } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al procesar consulta";
    console.error("AI query error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : 400 });
  }
}
