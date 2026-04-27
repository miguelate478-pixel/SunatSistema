/**
 * POST /api/admin/seed
 * One-time seed endpoint — protected by HEALTH_TOKEN
 * Use: POST /api/admin/seed with header X-Admin-Token: <HEALTH_TOKEN>
 * DELETE THIS FILE after first use in production.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  // Protect with admin token
  const token = request.headers.get("x-admin-token");
  const expected = process.env.HEALTH_TOKEN;
  if (!expected || token !== expected) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if already seeded
    const existingVouchers = await prisma.voucher.count();
    if (existingVouchers > 0) {
      return NextResponse.json({ success: true, message: `Already seeded — ${existingVouchers} vouchers exist`, skipped: true });
    }

    // Get company
    const company = await prisma.company.findFirst();
    if (!company) return NextResponse.json({ success: false, error: "No company found — run db:seed first" }, { status: 400 });

    // Get or create user
    let user = await prisma.user.findFirst({ where: { email: "carlos.mendoza@corpandina.com" } });
    if (!user) {
      const hashed = await bcrypt.hash("password123", 10);
      user = await prisma.user.create({ data: { email: "carlos.mendoza@corpandina.com", password: hashed, nombre: "Carlos Mendoza" } });
    }

    // Get or create suppliers
    const suppliers = await Promise.all([
      prisma.supplier.upsert({ where: { companyId_ruc: { companyId: company.id, ruc: "20100070970" } }, create: { companyId: company.id, ruc: "20100070970", razonSocial: "DISTRIBUIDORA NORTE S.A.C." }, update: {} }),
      prisma.supplier.upsert({ where: { companyId_ruc: { companyId: company.id, ruc: "20503840121" } }, create: { companyId: company.id, ruc: "20503840121", razonSocial: "SUMINISTROS TECH PERU S.A." }, update: {} }),
      prisma.supplier.upsert({ where: { companyId_ruc: { companyId: company.id, ruc: "20601234567" } }, create: { companyId: company.id, ruc: "20601234567", razonSocial: "IMPORTACIONES GLOBALES E.I.R.L." }, update: {} }),
    ]);

    // Get or create customers
    const customers = await Promise.all([
      prisma.customer.upsert({ where: { companyId_ruc: { companyId: company.id, ruc: "20301234567" } }, create: { companyId: company.id, ruc: "20301234567", razonSocial: "MINERA ANDAHUAYLAS S.A." }, update: {} }),
      prisma.customer.upsert({ where: { companyId_ruc: { companyId: company.id, ruc: "20456123789" } }, create: { companyId: company.id, ruc: "20456123789", razonSocial: "GRUPO EMPRESARIAL NORTE S.A.C." }, update: {} }),
    ]);

    // Create sample vouchers (compras)
    const compras = [
      { serie: "F001", numero: "00012345", tipo: "FACTURA", fecha: "2025-03-15", rucEmisor: suppliers[0].ruc, emisor: suppliers[0].razonSocial, subtotal: 8474.58, igv: 1525.42, total: 10000.0, detraccion: true, pctDet: 12, montoDet: 1200 },
      { serie: "F001", numero: "00012346", tipo: "FACTURA", fecha: "2025-03-16", rucEmisor: suppliers[1].ruc, emisor: suppliers[1].razonSocial, subtotal: 4237.29, igv: 762.71, total: 5000.0, detraccion: false, pctDet: 0, montoDet: 0 },
      { serie: "F001", numero: "00012347", tipo: "FACTURA", fecha: "2025-03-17", rucEmisor: suppliers[2].ruc, emisor: suppliers[2].razonSocial, subtotal: 6779.66, igv: 1220.34, total: 8000.0, detraccion: true, pctDet: 10, montoDet: 800 },
      { serie: "F001", numero: "00012348", tipo: "FACTURA", fecha: "2025-04-02", rucEmisor: suppliers[0].ruc, emisor: suppliers[0].razonSocial, subtotal: 3389.83, igv: 610.17, total: 4000.0, detraccion: false, pctDet: 0, montoDet: 0 },
      { serie: "B001", numero: "00001234", tipo: "BOLETA", fecha: "2025-04-10", rucEmisor: suppliers[1].ruc, emisor: suppliers[1].razonSocial, subtotal: 847.46, igv: 152.54, total: 1000.0, detraccion: false, pctDet: 0, montoDet: 0 },
    ];

    // Create sample vouchers (ventas)
    const ventas = [
      { serie: "F001", numero: "00045678", tipo: "FACTURA", fecha: "2025-03-15", rucReceptor: customers[0].ruc, receptor: customers[0].razonSocial, subtotal: 16949.15, igv: 3050.85, total: 20000.0 },
      { serie: "F001", numero: "00045679", tipo: "FACTURA", fecha: "2025-03-20", rucReceptor: customers[1].ruc, receptor: customers[1].razonSocial, subtotal: 8474.58, igv: 1525.42, total: 10000.0 },
      { serie: "F001", numero: "00045680", tipo: "FACTURA", fecha: "2025-04-05", rucReceptor: customers[0].ruc, receptor: customers[0].razonSocial, subtotal: 12711.86, igv: 2288.14, total: 15000.0 },
    ];

    let created = 0;

    for (const c of compras) {
      await prisma.voucher.create({
        data: {
          companyId: company.id,
          tipo: c.tipo,
          serie: c.serie,
          numero: c.numero,
          fechaEmision: new Date(c.fecha),
          rucEmisor: c.rucEmisor,
          razonSocialEmisor: c.emisor,
          rucReceptor: company.ruc,
          razonSocialReceptor: company.razonSocial,
          moneda: "PEN",
          subtotal: c.subtotal,
          igv: c.igv,
          total: c.total,
          estado: "ACEPTADO",
          tieneXML: true,
          tienePDF: true,
          tieneCDR: true,
          afectoDetraccion: c.detraccion,
          porcentajeDetraccion: c.detraccion ? c.pctDet : null,
          montoDetraccion: c.detraccion ? c.montoDet : null,
          estadoDetraccion: c.detraccion ? "PENDIENTE" : null,
          createdById: user.id,
          supplierId: suppliers.find(s => s.ruc === c.rucEmisor)?.id,
        },
      });
      created++;
    }

    for (const v of ventas) {
      await prisma.voucher.create({
        data: {
          companyId: company.id,
          tipo: v.tipo,
          serie: v.serie,
          numero: v.numero,
          fechaEmision: new Date(v.fecha),
          rucEmisor: company.ruc,
          razonSocialEmisor: company.razonSocial,
          rucReceptor: v.rucReceptor,
          razonSocialReceptor: v.receptor,
          moneda: "PEN",
          subtotal: v.subtotal,
          igv: v.igv,
          total: v.total,
          estado: "ACEPTADO",
          tieneXML: true,
          tienePDF: true,
          tieneCDR: true,
          afectoDetraccion: false,
          createdById: user.id,
          customerId: customers.find(cu => cu.ruc === v.rucReceptor)?.id,
        },
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      message: `Seed completed — ${created} vouchers created (${compras.length} compras + ${ventas.length} ventas)`,
      companyId: company.id,
      companyRuc: company.ruc,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Seed error";
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
