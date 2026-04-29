import { NextRequest, NextResponse } from "next/server";
import { requireCompanyAccess, requireRole } from "@/lib/auth/session";
import { voucherService } from "@/server/services/voucher.service";
import { voucherQuerySchema } from "@/lib/validators/voucher";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

// ── GET — list vouchers ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId requerido" }, { status: 400 });

    await requireCompanyAccess(companyId);

    // "tipo" param can be "COMPRA"/"VENTA" (direction) or "FACTURA"/"BOLETA" (doc type)
    const tipoParam = searchParams.get("tipo");
    const isDirectionFilter = tipoParam === "COMPRA" || tipoParam === "VENTA";
    const tipoDocParam = searchParams.get("tipoDoc");

    const query = voucherQuerySchema.parse({
      companyId,
      tipo: tipoDocParam || (isDirectionFilter ? undefined : (tipoParam || undefined)),
      estado: searchParams.get("estado") || undefined,
      fechaInicio: searchParams.get("fechaInicio") || undefined,
      fechaFin: searchParams.get("fechaFin") || undefined,
      search: searchParams.get("search") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "100"),
    });

    // Filter by direccion field (set when vouchers are downloaded from SIRE)
    // This is more reliable than filtering by RUC since SIRE data may have incomplete receptor RUCs
    const direccionFilter: string | undefined = isDirectionFilter ? tipoParam! : undefined;

    const result = await voucherService.getVouchers(query, undefined, direccionFilter);

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
        porcentajeDetraccion: v.porcentajeDetraccion ? Number(v.porcentajeDetraccion) : null,
        montoDetraccion: v.montoDetraccion ? Number(v.montoDetraccion) : null,
        estadoDetraccion: v.estadoDetraccion ?? null,
        observaciones: v.observaciones ?? null,
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

// ── POST — create voucher ──────────────────────────────────────────────────────

const createSchema = z.object({
  companyId: z.string().uuid(),
  tipo: z.enum(["FACTURA", "BOLETA", "NOTA_CREDITO", "NOTA_DEBITO", "RECIBO"]),
  serie: z.string().min(1).max(10),
  numero: z.string().min(1).max(20),
  fechaEmision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rucEmisor: z.string().length(11),
  razonSocialEmisor: z.string().min(1),
  rucReceptor: z.string().length(11),
  razonSocialReceptor: z.string().min(1),
  moneda: z.enum(["PEN", "USD"]).default("PEN"),
  subtotal: z.number().min(0),
  igv: z.number().min(0),
  total: z.number().min(0),
  estado: z.enum(["ACEPTADO", "RECHAZADO", "PENDIENTE", "ANULADO", "OBSERVADO"]).default("PENDIENTE"),
  afectoDetraccion: z.boolean().default(false),
  porcentajeDetraccion: z.number().optional(),
  montoDetraccion: z.number().optional(),
  observaciones: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "ADMIN_EMPRESA", "CONTABILIDAD"]);
    const body = await request.json();
    const data = createSchema.parse(body);

    await requireCompanyAccess(data.companyId);

    // Check for duplicate
    const existing = await prisma.voucher.findFirst({
      where: { companyId: data.companyId, serie: data.serie, numero: data.numero, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `El comprobante ${data.serie}-${data.numero} ya existe` },
        { status: 409 }
      );
    }

    const voucher = await prisma.voucher.create({
      data: {
        companyId: data.companyId,
        tipo: data.tipo,
        serie: data.serie,
        numero: data.numero,
        fechaEmision: new Date(data.fechaEmision),
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
        rucEmisor: data.rucEmisor,
        razonSocialEmisor: data.razonSocialEmisor,
        rucReceptor: data.rucReceptor,
        razonSocialReceptor: data.razonSocialReceptor,
        moneda: data.moneda,
        subtotal: data.subtotal,
        igv: data.igv,
        total: data.total,
        estado: data.estado,
        tieneXML: false,
        tienePDF: false,
        tieneCDR: false,
        afectoDetraccion: data.afectoDetraccion,
        porcentajeDetraccion: data.porcentajeDetraccion ?? null,
        montoDetraccion: data.montoDetraccion ?? null,
        estadoDetraccion: data.afectoDetraccion ? "PENDIENTE" : null,
        observaciones: data.observaciones ?? null,
        createdById: session.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: voucher.id, serie: voucher.serie, numero: voucher.numero },
      message: `Comprobante ${data.serie}-${data.numero} registrado correctamente`,
    }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error al crear comprobante";
    return NextResponse.json({ success: false, error: msg }, { status: msg === "No autenticado" ? 401 : msg === "No autorizado" ? 403 : 400 });
  }
}
