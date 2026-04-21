import { z } from "zod";

export const voucherItemSchema = z.object({
  descripcion: z.string().min(1, "Descripción requerida"),
  cantidad: z.number().positive("Cantidad debe ser positiva"),
  unidad: z.string().min(1, "Unidad requerida"),
  precioUnitario: z.number().positive("Precio unitario debe ser positivo"),
  subtotal: z.number(),
  igv: z.number(),
  total: z.number(),
  orden: z.number().optional(),
});

export const createVoucherSchema = z.object({
  companyId: z.string().uuid(),
  tipo: z.enum(["FACTURA", "BOLETA", "NOTA_CREDITO", "NOTA_DEBITO", "RECIBO"]),
  serie: z.string().min(4).max(4),
  numero: z.string().min(1).max(8),
  fechaEmision: z.string().or(z.date()),
  fechaVencimiento: z.string().or(z.date()).optional(),
  rucEmisor: z.string().length(11),
  razonSocialEmisor: z.string().min(1),
  rucReceptor: z.string().length(11),
  razonSocialReceptor: z.string().min(1),
  moneda: z.enum(["PEN", "USD"]).default("PEN"),
  subtotal: z.number(),
  igv: z.number(),
  total: z.number(),
  estado: z.enum(["ACEPTADO", "RECHAZADO", "PENDIENTE", "ANULADO", "OBSERVADO"]).default("PENDIENTE"),
  afectoDetraccion: z.boolean().default(false),
  porcentajeDetraccion: z.number().min(0).max(100).optional(),
  montoDetraccion: z.number().optional(),
  estadoDetraccion: z.enum(["PAGADO", "PENDIENTE", "VENCIDO"]).optional(),
  observaciones: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  items: z.array(voucherItemSchema).min(1, "Debe tener al menos un ítem"),
});

export const updateVoucherSchema = createVoucherSchema.partial().extend({
  id: z.string().uuid(),
});

export const voucherQuerySchema = z.object({
  companyId: z.string().uuid(),
  tipo: z.enum(["FACTURA", "BOLETA", "NOTA_CREDITO", "NOTA_DEBITO", "RECIBO"]).optional(),
  estado: z.enum(["ACEPTADO", "RECHAZADO", "PENDIENTE", "ANULADO", "OBSERVADO"]).optional(),
  fechaInicio: z.string().or(z.date()).optional(),
  fechaFin: z.string().or(z.date()).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;
export type UpdateVoucherInput = z.infer<typeof updateVoucherSchema>;
export type VoucherQueryInput = z.infer<typeof voucherQuerySchema>;
