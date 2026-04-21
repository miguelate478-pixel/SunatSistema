import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess } from "@/lib/auth/session";
import { voucherService } from "@/server/services/voucher.service";
import { voucherQuerySchema } from "@/lib/validators/voucher";
import prisma from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    const direccion = searchParams.get("tipo"); // "COMPRA" | "VENTA" | null

    // Build query — strip "COMPRA"/"VENTA" from tipo (not real voucher types)
    const tipoParam = searchParams.get("tipo");
    const isDirectionFilter = tipoParam === "COMPRA" || tipoParam === "VENTA";

    const query = voucherQuerySchema.parse({
      companyId,
      tipo: isDirectionFilter ? undefined : (tipoParam || undefined),
      estado: searchParams.get("estado") || undefined,
      fechaInicio: searchParams.get("fechaInicio") || undefined,
      fechaFin: searchParams.get("fechaFin") || undefined,
      search: searchParams.get("search") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "50"),
    });

    // If filtering by COMPRA/VENTA, add RUC filter
    let rucFilter: { rucReceptor?: string; rucEmisor?: string } = {};
    if (direccion === "COMPRA" || direccion === "VENTA") {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (company) {
        if (direccion === "COMPRA") rucFilter = { rucReceptor: company.ruc };
        if (direccion === "VENTA") rucFilter = { rucEmisor: company.ruc };
      }
    }

    const result = await voucherService.getVouchers(query, rucFilter);

    return NextResponse.json({
      success: true,
      data: result.data.map((v) => ({
        id: v.id,
        serie: v.serie,
        numero: v.numero,
        tipo: v.tipo,
        razonSocialEmisor: v.razonSocialEmisor,
        rucEmisor: v.rucEmisor,
        razonSocialReceptor: v.razonSocialReceptor,
        rucReceptor: v.rucReceptor,
        fechaEmision: v.fechaEmision instanceof Date ? v.fechaEmision.toISOString() : v.fechaEmision,
        fechaVencimiento: v.fechaVencimiento instanceof Date ? v.fechaVencimiento.toISOString() : (v.fechaVencimiento ?? null),
        subtotal: Number(v.subtotal),
        igv: Number(v.igv),
        total: Number(v.total),
        moneda: v.moneda,
        tieneXML: v.tieneXML,
        tienePDF: v.tienePDF,
        tieneCDR: v.tieneCDR,
        estado: v.estado,
        afectoDetraccion: v.afectoDetraccion,
        // Flat detraction fields (from DB columns)
        porcentajeDetraccion: v.porcentajeDetraccion ? Number(v.porcentajeDetraccion) : null,
        montoDetraccion: v.montoDetraccion ? Number(v.montoDetraccion) : null,
        estadoDetraccion: v.estadoDetraccion ?? null,
        observaciones: v.observaciones ?? null,
        // Nested detraction object (from relation)
        detraccion: v.detraction ? {
          porcentaje: Number(v.detraction.porcentaje),
          monto: Number(v.detraction.monto),
          estado: v.detraction.estado,
        } : null,
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al obtener comprobantes";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 400 });
  }
}
