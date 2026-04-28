/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import prisma from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const query = searchParams.get("query") || "";
    const tipo = searchParams.get("tipo");
    const periodo = searchParams.get("periodo");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "companyId requerido" },
        { status: 400 }
      );
    }

    // Verify user has access to this company
    const hasAccess = session.companyRoles.some((cr) => cr.company.id === companyId);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "No tienes acceso a esta empresa" },
        { status: 403 }
      );
    }

    const where: any = {
      companyId,
      deletedAt: null,
    };

    if (query) {
      where.OR = [
        { rucEmisor: { contains: query } },
        { razonSocialEmisor: { contains: query, mode: "insensitive" } },
        { serie: { contains: query } },
        { numero: { contains: query } },
      ];
    }

    if (tipo) {
      where.tipo = tipo;
    }

    if (periodo) {
      // periodo format: YYYYMM
      const year = parseInt(periodo.substring(0, 4));
      const month = parseInt(periodo.substring(4, 6));
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      where.fechaEmision = {
        gte: startDate,
        lte: endDate,
      };
    }

    const [total, vouchers] = await Promise.all([
      prisma.voucher.count({ where }),
      prisma.voucher.findMany({
        where,
        orderBy: { fechaEmision: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: vouchers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Error searching vouchers:", error);
    return NextResponse.json(
      { success: false, error: "Error al buscar comprobantes" },
      { status: 500 }
    );
  }
}
