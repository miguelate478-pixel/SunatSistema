import { z } from "zod";

export const createCompanySchema = z.object({
  ruc: z.string().length(11, "RUC debe tener 11 dígitos"),
  razonSocial: z.string().min(1, "Razón social requerida"),
  nombreComercial: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  logo: z.string().url().optional(),
  sector: z.string().min(1, "Sector requerido"),
  plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]).default("PROFESSIONAL"),
});

export const updateCompanySchema = createCompanySchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
