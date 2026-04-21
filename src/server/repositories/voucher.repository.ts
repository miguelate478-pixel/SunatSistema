import prisma from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { VoucherQueryInput } from "@/lib/validators/voucher";

export class VoucherRepository {
  async findById(id: string) {
    return prisma.voucher.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: "asc" } },
        documents: true,
        detraction: true,
        supplier: true,
        customer: true,
      },
    });
  }

  async findMany(query: VoucherQueryInput, rucFilter?: { rucReceptor?: string; rucEmisor?: string }) {
    const { companyId, tipo, estado, fechaInicio, fechaFin, search, page, limit } = query;

    const where: Prisma.VoucherWhereInput = {
      companyId,
      deletedAt: null,
      ...(tipo && { tipo }),
      ...(estado && { estado }),
      ...(rucFilter?.rucReceptor && { rucReceptor: rucFilter.rucReceptor }),
      ...(rucFilter?.rucEmisor && { rucEmisor: rucFilter.rucEmisor }),
      ...(fechaInicio && fechaFin && {
        fechaEmision: {
          gte: new Date(fechaInicio),
          lte: new Date(fechaFin),
        },
      }),
      ...(search && {
        OR: [
          { serie: { contains: search, mode: "insensitive" } },
          { numero: { contains: search, mode: "insensitive" } },
          { rucEmisor: { contains: search } },
          { razonSocialEmisor: { contains: search, mode: "insensitive" } },
          { rucReceptor: { contains: search } },
          { razonSocialReceptor: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        include: {
          items: { orderBy: { orden: "asc" } },
          documents: true,
          detraction: true,
        },
        orderBy: { fechaEmision: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.voucher.count({ where }),
    ]);

    return {
      data: vouchers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: Prisma.VoucherCreateInput) {
    return prisma.voucher.create({
      data,
      include: {
        items: true,
        documents: true,
        detraction: true,
      },
    });
  }

  async update(id: string, data: Prisma.VoucherUpdateInput) {
    return prisma.voucher.update({
      where: { id },
      data,
      include: {
        items: true,
        documents: true,
        detraction: true,
      },
    });
  }

  async softDelete(id: string) {
    return prisma.voucher.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getStats(companyId: string, fechaInicio?: Date, fechaFin?: Date) {
    const where: Prisma.VoucherWhereInput = {
      companyId,
      deletedAt: null,
      ...(fechaInicio && fechaFin && {
        fechaEmision: {
          gte: fechaInicio,
          lte: fechaFin,
        },
      }),
    };

    const [total, byTipo, byEstado, totalAmount] = await Promise.all([
      prisma.voucher.count({ where }),
      prisma.voucher.groupBy({
        by: ["tipo"],
        where,
        _count: true,
      }),
      prisma.voucher.groupBy({
        by: ["estado"],
        where,
        _count: true,
      }),
      prisma.voucher.aggregate({
        where,
        _sum: { total: true },
      }),
    ]);

    return {
      total,
      byTipo,
      byEstado,
      totalAmount: totalAmount._sum.total || 0,
    };
  }
}

export const voucherRepository = new VoucherRepository();
