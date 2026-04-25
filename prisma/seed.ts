import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // Clean database
  await prisma.auditLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.accountPayable.deleteMany();
  await prisma.accountReceivable.deleteMany();
  await prisma.detraction.deleteMany();
  await prisma.voucherDocument.deleteMany();
  await prisma.voucherItem.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.userCompanyRole.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();

  console.log("✅ Database cleaned");

  // Create Roles
  const roles = await Promise.all([
    prisma.role.create({
      data: {
        name: "SUPER_ADMIN",
        description: "Administrador del sistema",
        permissions: JSON.stringify(["*"]),
      },
    }),
    prisma.role.create({
      data: {
        name: "ADMIN_EMPRESA",
        description: "Administrador de empresa",
        permissions: JSON.stringify(["company.*", "user.read", "voucher.*", "report.*"]),
      },
    }),
    prisma.role.create({
      data: {
        name: "CONTABILIDAD",
        description: "Contador",
        permissions: JSON.stringify(["voucher.*", "report.read"]),
      },
    }),
    prisma.role.create({
      data: {
        name: "TESORERIA",
        description: "Tesorero",
        permissions: JSON.stringify(["voucher.read", "account.*", "detraction.*"]),
      },
    }),
    prisma.role.create({
      data: {
        name: "GERENCIA",
        description: "Gerente",
        permissions: JSON.stringify(["*.read", "report.*"]),
      },
    }),
    prisma.role.create({
      data: {
        name: "AUDITOR",
        description: "Auditor",
        permissions: JSON.stringify(["*.read"]),
      },
    }),
  ]);

  console.log("✅ Roles created");

  // Create Users
  const hashedPassword = await bcrypt.hash("password123", 10);

  const user1 = await prisma.user.create({
    data: {
      email: "carlos.mendoza@corpandina.com",
      password: hashedPassword,
      nombre: "Carlos Mendoza",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "admin@sunat.com",
      password: hashedPassword,
      nombre: "Admin Sistema",
    },
  });

  console.log("✅ Users created");

  // Create Company
  const company = await prisma.company.create({
    data: {
      ruc: "20610169849",
      razonSocial: "CORPORACIÓN ANDINA S.A.C.",
      nombreComercial: "CorpAndina",
      direccion: "Av. Javier Prado Este 123, San Isidro, Lima",
      telefono: "01-4567890",
      email: "contacto@corpandina.com",
      sector: "Comercio",
      plan: "PROFESSIONAL",
      createdById: user1.id,
    },
  });

  console.log("✅ Company created");

  // Assign roles
  await prisma.userCompanyRole.create({
    data: {
      userId: user1.id,
      companyId: company.id,
      roleId: roles.find((r) => r.name === "ADMIN_EMPRESA")!.id,
    },
  });

  await prisma.userCompanyRole.create({
    data: {
      userId: user2.id,
      companyId: company.id,
      roleId: roles.find((r) => r.name === "SUPER_ADMIN")!.id,
    },
  });

  console.log("✅ User roles assigned");

  // Create Suppliers
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        companyId: company.id,
        ruc: "20100070970",
        razonSocial: "DISTRIBUIDORA NORTE S.A.C.",
        nombreComercial: "Distribuidora Norte",
        direccion: "Av. Industrial 456, Los Olivos, Lima",
        telefono: "01-5678901",
        email: "ventas@distribuidoranorte.com",
        contacto: "Juan Pérez",
      },
    }),
    prisma.supplier.create({
      data: {
        companyId: company.id,
        ruc: "20503840121",
        razonSocial: "SUMINISTROS TECH PERU S.A.",
        nombreComercial: "Tech Peru",
        direccion: "Jr. Tecnología 789, Miraflores, Lima",
        telefono: "01-6789012",
        email: "contacto@techperu.com",
        contacto: "María García",
      },
    }),
    prisma.supplier.create({
      data: {
        companyId: company.id,
        ruc: "20601234567",
        razonSocial: "IMPORTACIONES GLOBALES E.I.R.L.",
        nombreComercial: "Importaciones Globales",
        direccion: "Av. Comercio 321, Callao",
        telefono: "01-7890123",
        email: "info@impglobales.com",
        contacto: "Roberto Silva",
      },
    }),
  ]);

  console.log("✅ Suppliers created");

  // Create Customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        companyId: company.id,
        ruc: "20301234567",
        razonSocial: "MINERA ANDAHUAYLAS S.A.",
        nombreComercial: "Minera Andahuaylas",
        direccion: "Av. Minería 100, Andahuaylas",
        telefono: "083-421234",
        email: "compras@mineraandahuaylas.com",
        contacto: "Luis Torres",
      },
    }),
    prisma.customer.create({
      data: {
        companyId: company.id,
        ruc: "20456123789",
        razonSocial: "GRUPO EMPRESARIAL NORTE S.A.C.",
        nombreComercial: "Grupo Norte",
        direccion: "Av. Empresarial 200, Trujillo",
        telefono: "044-234567",
        email: "adquisiciones@gruponorte.com",
        contacto: "Ana Rodríguez",
      },
    }),
  ]);

  console.log("✅ Customers created");

  // Create Vouchers (Compras)
  const voucher1 = await prisma.voucher.create({
    data: {
      companyId: company.id,
      tipo: "FACTURA",
      serie: "F001",
      numero: "00012345",
      fechaEmision: new Date("2024-04-15"),
      fechaVencimiento: new Date("2024-05-15"),
      rucEmisor: suppliers[0].ruc,
      razonSocialEmisor: suppliers[0].razonSocial,
      rucReceptor: company.ruc,
      razonSocialReceptor: company.razonSocial,
      moneda: "PEN",
      subtotal: 8474.58,
      igv: 1525.42,
      total: 10000.0,
      estado: "ACEPTADO",
      tieneXML: true,
      tienePDF: true,
      tieneCDR: true,
      afectoDetraccion: true,
      porcentajeDetraccion: 12,
      montoDetraccion: 1200.0,
      estadoDetraccion: "PAGADO",
      supplierId: suppliers[0].id,
      createdById: user1.id,
      items: {
        create: [
          {
            descripcion: "LAPTOP DELL INSPIRON 15 3000",
            cantidad: 5,
            unidad: "UND",
            precioUnitario: 1694.92,
            subtotal: 8474.58,
            igv: 1525.42,
            total: 10000.0,
            orden: 0,
          },
        ],
      },
      detraction: {
        create: {
          porcentaje: 12,
          monto: 1200.0,
          estado: "PAGADO",
          fechaPago: new Date("2024-04-16"),
          numeroConstancia: "00123456789",
        },
      },
    },
  });

  await prisma.voucher.create({
    data: {
      companyId: company.id,
      tipo: "FACTURA",
      serie: "F001",
      numero: "00012346",
      fechaEmision: new Date("2024-04-16"),
      fechaVencimiento: new Date("2024-05-16"),
      rucEmisor: suppliers[1].ruc,
      razonSocialEmisor: suppliers[1].razonSocial,
      rucReceptor: company.ruc,
      razonSocialReceptor: company.razonSocial,
      moneda: "PEN",
      subtotal: 4237.29,
      igv: 762.71,
      total: 5000.0,
      estado: "ACEPTADO",
      tieneXML: true,
      tienePDF: false,
      tieneCDR: true,
      afectoDetraccion: false,
      supplierId: suppliers[1].id,
      observaciones: "PDF pendiente de descarga",
      createdById: user1.id,
      items: {
        create: [
          {
            descripcion: "MONITOR LG 27 PULGADAS 4K",
            cantidad: 3,
            unidad: "UND",
            precioUnitario: 847.46,
            subtotal: 2542.37,
            igv: 457.63,
            total: 3000.0,
            orden: 0,
          },
          {
            descripcion: "TECLADO MECÁNICO LOGITECH G915",
            cantidad: 5,
            unidad: "UND",
            precioUnitario: 338.98,
            subtotal: 1694.92,
            igv: 305.08,
            total: 2000.0,
            orden: 1,
          },
        ],
      },
    },
  });

  await prisma.voucher.create({
    data: {
      companyId: company.id,
      tipo: "FACTURA",
      serie: "F001",
      numero: "00012347",
      fechaEmision: new Date("2024-04-17"),
      rucEmisor: suppliers[2].ruc,
      razonSocialEmisor: suppliers[2].razonSocial,
      rucReceptor: company.ruc,
      razonSocialReceptor: company.razonSocial,
      moneda: "USD",
      subtotal: 6779.66,
      igv: 1220.34,
      total: 8000.0,
      estado: "OBSERVADO",
      tieneXML: true,
      tienePDF: true,
      tieneCDR: false,
      afectoDetraccion: true,
      porcentajeDetraccion: 10,
      montoDetraccion: 800.0,
      estadoDetraccion: "PENDIENTE",
      supplierId: suppliers[2].id,
      observaciones: "CDR no descargado. Detracción pendiente de pago.",
      createdById: user1.id,
      items: {
        create: [
          {
            descripcion: "SERVIDOR HP PROLIANT DL380 GEN10",
            cantidad: 1,
            unidad: "UND",
            precioUnitario: 6779.66,
            subtotal: 6779.66,
            igv: 1220.34,
            total: 8000.0,
            orden: 0,
          },
        ],
      },
      detraction: {
        create: {
          porcentaje: 10,
          monto: 800.0,
          estado: "PENDIENTE",
        },
      },
    },
  });

  // Create Vouchers (Ventas)
  const voucher4 = await prisma.voucher.create({
    data: {
      companyId: company.id,
      tipo: "FACTURA",
      serie: "F001",
      numero: "00045678",
      fechaEmision: new Date("2024-04-15"),
      fechaVencimiento: new Date("2024-05-15"),
      rucEmisor: company.ruc,
      razonSocialEmisor: company.razonSocial,
      rucReceptor: customers[0].ruc,
      razonSocialReceptor: customers[0].razonSocial,
      moneda: "PEN",
      subtotal: 16949.15,
      igv: 3050.85,
      total: 20000.0,
      estado: "ACEPTADO",
      tieneXML: true,
      tienePDF: true,
      tieneCDR: true,
      afectoDetraccion: true,
      porcentajeDetraccion: 10,
      montoDetraccion: 2000.0,
      estadoDetraccion: "PAGADO",
      customerId: customers[0].id,
      createdById: user1.id,
      items: {
        create: [
          {
            descripcion: "EQUIPOS DE CÓMPUTO CORPORATIVO - LOTE 10",
            cantidad: 10,
            unidad: "UND",
            precioUnitario: 1694.92,
            subtotal: 16949.15,
            igv: 3050.85,
            total: 20000.0,
            orden: 0,
          },
        ],
      },
      detraction: {
        create: {
          porcentaje: 10,
          monto: 2000.0,
          estado: "PAGADO",
          fechaPago: new Date("2024-04-16"),
          numeroConstancia: "00987654321",
        },
      },
    },
  });

  console.log("✅ Vouchers created");

  // Create Account Payable
  await prisma.accountPayable.create({
    data: {
      companyId: company.id,
      voucherId: voucher1.id,
      supplierId: suppliers[0].id,
      proveedor: suppliers[0].razonSocial,
      ruc: suppliers[0].ruc,
      documento: "F001-00012345",
      monto: 10000.0,
      moneda: "PEN",
      fechaEmision: new Date("2024-04-15"),
      fechaVencimiento: new Date("2024-05-15"),
      diasVencimiento: 25,
      estado: "VIGENTE",
      saldo: 10000.0,
    },
  });

  // Create Account Receivable
  await prisma.accountReceivable.create({
    data: {
      companyId: company.id,
      voucherId: voucher4.id,
      customerId: customers[0].id,
      cliente: customers[0].razonSocial,
      ruc: customers[0].ruc,
      documento: "F001-00045678",
      monto: 20000.0,
      moneda: "PEN",
      fechaEmision: new Date("2024-04-15"),
      fechaVencimiento: new Date("2024-05-15"),
      diasVencimiento: 25,
      estado: "VIGENTE",
      saldo: 20000.0,
    },
  });

  console.log("✅ Accounts created");

  // Create Alerts
  await Promise.all([
    prisma.alert.create({
      data: {
        companyId: company.id,
        tipo: "ERROR",
        categoria: "DOCUMENTOS",
        titulo: "XML faltante detectado",
        descripcion: "La factura F001-00012348 no tiene XML descargado.",
        accion: "Descargar XML",
        createdById: user1.id,
      },
    }),
    prisma.alert.create({
      data: {
        companyId: company.id,
        tipo: "WARNING",
        categoria: "DETRACCIONES",
        titulo: "Detracción próxima a vencer",
        descripcion: "La detracción de F001-00012347 por S/ 800.00 vence en 3 días.",
        accion: "Ver detalle",
        createdById: user1.id,
      },
    }),
    prisma.alert.create({
      data: {
        companyId: company.id,
        tipo: "WARNING",
        categoria: "IMPUESTOS",
        titulo: "Declaración IGV próxima",
        descripcion: "La declaración mensual de IGV vence en 8 días. Monto estimado: S/ 45,320.00",
        accion: "Ver reporte",
        createdById: user1.id,
      },
    }),
    prisma.alert.create({
      data: {
        companyId: company.id,
        tipo: "SUCCESS",
        categoria: "SUNAT",
        titulo: "Sincronización completada",
        descripcion: "Se descargaron 47 comprobantes nuevos de SUNAT exitosamente.",
        leida: true,
        createdById: user1.id,
      },
    }),
  ]);

  console.log("✅ Alerts created");

  console.log("🎉 Seed completed successfully!");
  console.log("\n📧 Login credentials:");
  console.log("Email: carlos.mendoza@corpandina.com");
  console.log("Password: password123");
  console.log("\nEmail: admin@sunat.com");
  console.log("Password: password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
