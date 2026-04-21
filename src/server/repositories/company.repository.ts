import prisma from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export class CompanyRepository {
  async findById(id: string) {
    return prisma.company.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                email: true,
                avatar: true,
              },
            },
            role: true,
          },
        },
      },
    });
  }

  async findByRuc(ruc: string) {
    return prisma.company.findUnique({
      where: { ruc },
    });
  }

  async findMany(userId?: string) {
    const where: Prisma.CompanyWhereInput = {
      isActive: true,
      ...(userId && {
        userRoles: {
          some: {
            userId,
            isActive: true,
          },
        },
      }),
    };

    return prisma.company.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: Prisma.CompanyCreateInput) {
    return prisma.company.create({
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.CompanyUpdateInput) {
    return prisma.company.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.company.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

export const companyRepository = new CompanyRepository();
