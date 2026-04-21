import { voucherRepository } from "../repositories/voucher.repository";
import prisma from "@/lib/db/prisma";
import type { CreateVoucherInput, VoucherQueryInput } from "@/lib/validators/voucher";

export class VoucherService {
  async getVouchers(query: VoucherQueryInput, rucFilter?: { rucReceptor?: string; rucEmisor?: string }) {
    return voucherRepository.findMany(query, rucFilter);
  }

  async getVoucherById(id: string) {
    const voucher = await voucherRepository.findById(id);
    if (!voucher) {
      throw new Error("Comprobante no encontrado");
    }
    return voucher;
  }

  async createVoucher(input: CreateVoucherInput, createdById: string) {
    const { items, supplierId, customerId, ...voucherData } = input;

    // Check if voucher already exists
    const existing = await prisma.voucher.findFirst({
      where: {
        companyId: input.companyId,
        serie: input.serie,
        numero: input.numero,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new Error("Ya existe un comprobante con esta serie y número");
    }

    // Create voucher with items
    const voucher = await prisma.voucher.create({
      data: {
        ...voucherData,
        createdById,
        ...(supplierId && { supplierId }),
        ...(customerId && { customerId }),
        items: {
          create: items.map((item, index) => ({
            ...item,
            orden: index,
          })),
        },
        ...(input.afectoDetraccion &&
          input.porcentajeDetraccion &&
          input.montoDetraccion && {
            detraction: {
              create: {
                porcentaje: input.porcentajeDetraccion,
                monto: input.montoDetraccion,
                estado: input.estadoDetraccion || "PENDIENTE",
              },
            },
          }),
      },
      include: {
        items: true,
        documents: true,
        detraction: true,
      },
    });

    // Create account receivable or payable based on voucher type
    if (input.tipo === "FACTURA" || input.tipo === "BOLETA") {
      const isIncome = input.rucEmisor === (await prisma.company.findUnique({ where: { id: input.companyId } }))?.ruc;

      if (isIncome && input.fechaVencimiento) {
        // Create account receivable
        await prisma.accountReceivable.create({
          data: {
            companyId: input.companyId,
            voucherId: voucher.id,
            customerId,
            cliente: input.razonSocialReceptor,
            ruc: input.rucReceptor,
            documento: `${input.serie}-${input.numero}`,
            monto: Number(input.total),
            moneda: input.moneda,
            fechaEmision: new Date(input.fechaEmision),
            fechaVencimiento: new Date(input.fechaVencimiento),
            diasVencimiento: Math.ceil(
              (new Date(input.fechaVencimiento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            ),
            estado: "VIGENTE",
            saldo: Number(input.total),
          },
        });
      } else if (!isIncome && input.fechaVencimiento) {
        // Create account payable
        await prisma.accountPayable.create({
          data: {
            companyId: input.companyId,
            voucherId: voucher.id,
            supplierId,
            proveedor: input.razonSocialEmisor,
            ruc: input.rucEmisor,
            documento: `${input.serie}-${input.numero}`,
            monto: Number(input.total),
            moneda: input.moneda,
            fechaEmision: new Date(input.fechaEmision),
            fechaVencimiento: new Date(input.fechaVencimiento),
            diasVencimiento: Math.ceil(
              (new Date(input.fechaVencimiento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            ),
            estado: "VIGENTE",
            saldo: Number(input.total),
          },
        });
      }
    }

    return voucher;
  }

  async updateVoucher(id: string, data: Partial<CreateVoucherInput>) {
    const voucher = await voucherRepository.findById(id);
    if (!voucher) {
      throw new Error("Comprobante no encontrado");
    }

    const { items, ...voucherData } = data;

    // Update voucher
    await prisma.voucher.update({
      where: { id },
      data: voucherData,
      include: {
        items: true,
        documents: true,
        detraction: true,
      },
    });

    // Update items if provided
    if (items) {
      // Delete existing items
      await prisma.voucherItem.deleteMany({
        where: { voucherId: id },
      });

      // Create new items
      await prisma.voucherItem.createMany({
        data: items.map((item, index) => ({
          voucherId: id,
          ...item,
          orden: index,
        })),
      });
    }

    return voucherRepository.findById(id);
  }

  async deleteVoucher(id: string) {
    return voucherRepository.softDelete(id);
  }

  async getVoucherStats(companyId: string, fechaInicio?: Date, fechaFin?: Date) {
    return voucherRepository.getStats(companyId, fechaInicio, fechaFin);
  }

  async uploadDocument(voucherId: string, tipo: "XML" | "PDF" | "CDR", file: {
    filename: string;
    filepath: string;
    filesize: number;
    mimeType: string;
  }) {
    const voucher = await voucherRepository.findById(voucherId);
    if (!voucher) {
      throw new Error("Comprobante no encontrado");
    }

    // Create document record
    const document = await prisma.voucherDocument.create({
      data: {
        voucherId,
        tipo,
        ...file,
      },
    });

    // Update voucher flags
    const updateData: { tieneXML?: boolean; tienePDF?: boolean; tieneCDR?: boolean } = {};
    if (tipo === "XML") updateData.tieneXML = true;
    if (tipo === "PDF") updateData.tienePDF = true;
    if (tipo === "CDR") updateData.tieneCDR = true;

    await prisma.voucher.update({
      where: { id: voucherId },
      data: updateData,
    });

    return document;
  }
}

export const voucherService = new VoucherService();
