import prisma from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        companyRoles: {
          include: {
            company: true,
            role: true,
          },
        },
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: {
        companyRoles: {
          where: { isActive: true },
          include: {
            company: true,
            role: true,
          },
        },
      },
    });
  }

  async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data,
      include: {
        companyRoles: {
          include: {
            company: true,
            role: true,
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async assignRole(userId: string, companyId: string, roleId: string) {
    return prisma.userCompanyRole.create({
      data: {
        userId,
        companyId,
        roleId,
      },
    });
  }

  async removeRole(userId: string, companyId: string, roleId: string) {
    return prisma.userCompanyRole.updateMany({
      where: {
        userId,
        companyId,
        roleId,
      },
      data: {
        isActive: false,
      },
    });
  }
}

export const userRepository = new UserRepository();
