import prisma from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export class DashboardService {
  async getSummary(companyId: string, fechaInicio?: Date, fechaFin?: Date) {
    const where: Prisma.VoucherWhereInput = {
      companyId,
      deletedAt: null,
      ...(fechaInicio && fechaFin && {
        fechaEmision: { gte: fechaInicio, lte: fechaFin },
      }),
    };

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    const ruc = company?.ruc ?? "";

    // Find the last month that has actual data
    const lastVoucher = await prisma.voucher.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { fechaEmision: "desc" },
      select: { fechaEmision: true },
    });

    // Use last month with data, or current month if no data
    const refDate = lastVoucher?.fechaEmision ?? new Date();
    const currentMonthStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const currentMonthEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    const previousMonthStart = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
    const previousMonthEnd = new Date(refDate.getFullYear(), refDate.getMonth(), 0);

    const [
      comprasMes,
      comprasMesAnterior,
      ventasMes,
      ventasMesAnterior,
      documentosDescargados,
      xmlFaltantes,
      pdfFaltantes,
      cdrFaltantes,
      facturasObservadas,
      detracciones,
      detraccionesPendientes,
      cuentasCobrar,
      cuentasPagar,
    ] = await Promise.all([
      prisma.voucher.aggregate({
        where: { ...where, fechaEmision: { gte: currentMonthStart, lte: currentMonthEnd }, rucReceptor: ruc },
        _sum: { total: true },
      }),
      prisma.voucher.aggregate({
        where: { ...where, fechaEmision: { gte: previousMonthStart, lte: previousMonthEnd }, rucReceptor: ruc },
        _sum: { total: true },
      }),
      prisma.voucher.aggregate({
        where: { ...where, fechaEmision: { gte: currentMonthStart, lte: currentMonthEnd }, rucEmisor: ruc },
        _sum: { total: true },
      }),
      prisma.voucher.aggregate({
        where: { ...where, fechaEmision: { gte: previousMonthStart, lte: previousMonthEnd }, rucEmisor: ruc },
        _sum: { total: true },
      }),
      // Documentos descargados
      prisma.voucher.count({ where }),
      // XML faltantes
      prisma.voucher.count({ where: { ...where, tieneXML: false } }),
      // PDF faltantes
      prisma.voucher.count({ where: { ...where, tienePDF: false } }),
      // CDR faltantes
      prisma.voucher.count({ where: { ...where, tieneCDR: false } }),
      // Facturas observadas
      prisma.voucher.count({ where: { ...where, estado: "OBSERVADO" } }),
      // Detracciones totales
      prisma.detraction.count({
        where: {
          voucher: { companyId },
        },
      }),
      // Detracciones pendientes
      prisma.detraction.count({
        where: {
          voucher: { companyId },
          estado: "PENDIENTE",
        },
      }),
      // Cuentas por cobrar
      prisma.accountReceivable.aggregate({
        where: { companyId, estado: { in: ["VIGENTE", "VENCIDO", "VENCE_HOY"] } },
        _sum: { saldo: true },
      }),
      // Cuentas por pagar
      prisma.accountPayable.aggregate({
        where: { companyId, estado: { in: ["VIGENTE", "VENCIDO"] } },
        _sum: { saldo: true },
      }),
    ]);

    return {
      comprasMes: Number(comprasMes._sum.total || 0),
      comprasMesAnterior: Number(comprasMesAnterior._sum.total || 0),
      ventasMes: Number(ventasMes._sum.total || 0),
      ventasMesAnterior: Number(ventasMesAnterior._sum.total || 0),
      documentosDescargados,
      xmlFaltantes,
      pdfFaltantes,
      cdrFaltantes,
      facturasObservadas,
      detracciones,
      detraccionesPendientes,
      cuentasCobrar: Number(cuentasCobrar._sum.saldo || 0),
      cuentasPagar: Number(cuentasPagar._sum.saldo || 0),
      impuestoProximo: 45320.0, // Mock - calcular según lógica real
      diasParaImpuesto: 8, // Mock - calcular según fecha
      periodoReferencia: currentMonthStart.toLocaleDateString("es-PE", { month: "long", year: "numeric" }),
    };
  }

  async getCharts(companyId: string) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error("Empresa no encontrada");

    // Get last 7 months
    const months = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(date);
    }

    const ventasCompras = await Promise.all(
      months.map(async (month) => {
        const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
        const [ventas, compras] = await Promise.all([
          prisma.voucher.aggregate({
            where: { companyId, deletedAt: null, rucEmisor: company.ruc, fechaEmision: { gte: month, lt: nextMonth } },
            _sum: { total: true },
          }),
          prisma.voucher.aggregate({
            where: { companyId, deletedAt: null, rucReceptor: company.ruc, fechaEmision: { gte: month, lt: nextMonth } },
            _sum: { total: true },
          }),
        ]);
        return {
          mes: month.toLocaleDateString("es-PE", { month: "short" }),
          ventas: Number(ventas._sum.total || 0),
          compras: Number(compras._sum.total || 0),
        };
      })
    );

    // Distribution by type
    const distribucion = await prisma.voucher.groupBy({
      by: ["tipo"],
      where: { companyId, deletedAt: null },
      _count: true,
    });
    const totalDocs = distribucion.reduce((sum, item) => sum + item._count, 0);
    const documentos = distribucion.map((item) => ({
      tipo: item.tipo,
      cantidad: item._count,
      porcentaje: totalDocs > 0 ? Math.round((item._count / totalDocs) * 100) : 0,
    }));

    // Flujo de caja — last 4 weeks with real per-week data
    const flujoCaja = await Promise.all(
      Array.from({ length: 4 }, (_, i) => {
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() - (3 - i) * 7);
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekEnd.getDate() - 6);
        return Promise.all([
          prisma.voucher.aggregate({
            where: { companyId, deletedAt: null, rucEmisor: company.ruc, fechaEmision: { gte: weekStart, lte: weekEnd } },
            _sum: { total: true },
          }),
          prisma.voucher.aggregate({
            where: { companyId, deletedAt: null, rucReceptor: company.ruc, fechaEmision: { gte: weekStart, lte: weekEnd } },
            _sum: { total: true },
          }),
        ]).then(([ventas, compras]) => ({
          semana: `Sem ${i + 1}`,
          ingresos: Number(ventas._sum.total || 0),
          egresos: Number(compras._sum.total || 0),
          neto: Number(ventas._sum.total || 0) - Number(compras._sum.total || 0),
        }));
      })
    );

    return {
      ventasCompras,
      documentos,
      flujoCaja,
    };
  }

  async getRecentVouchers(companyId: string, limit = 5) {
    return prisma.voucher.findMany({
      where: { companyId, deletedAt: null },
      include: {
        items: true,
        detraction: true,
      },
      orderBy: { fechaEmision: "desc" },
      take: limit,
    });
  }

  async getTopProveedores(companyId: string, limit = 5) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return [];

    const result = await prisma.voucher.groupBy({
      by: ["rucEmisor", "razonSocialEmisor"],
      where: {
        companyId,
        deletedAt: null,
        rucReceptor: company.ruc,
      },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: "desc" } },
      take: limit,
    });

    return result.map((item) => ({
      ruc: item.rucEmisor,
      nombre: item.razonSocialEmisor,
      monto: Number(item._sum.total || 0),
      facturas: item._count,
    }));
  }

  async getTopClientes(companyId: string, limit = 5) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return [];

    const result = await prisma.voucher.groupBy({
      by: ["rucReceptor", "razonSocialReceptor"],
      where: {
        companyId,
        deletedAt: null,
        rucEmisor: company.ruc,
      },
      _sum: { total: true },
      _count: true,
      orderBy: { _sum: { total: "desc" } },
      take: limit,
    });

    return result.map((item) => ({
      ruc: item.rucReceptor,
      nombre: item.razonSocialReceptor,
      monto: Number(item._sum.total || 0),
      facturas: item._count,
    }));
  }

  async getRecentAlertas(companyId: string, limit = 5) {
    const alertas = await prisma.alert.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        tipo: true,
        titulo: true,
        descripcion: true,
        leida: true,
        createdAt: true,
      },
    });
    return alertas.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      titulo: a.titulo,
      descripcion: a.descripcion,
      leida: a.leida,
      fecha: a.createdAt.toISOString(),
    }));
  }
}

export const dashboardService = new DashboardService();
