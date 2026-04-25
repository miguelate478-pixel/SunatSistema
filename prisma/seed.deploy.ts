/**
 * Deploy seed — only runs if DB is empty.
 * Safe to run on every deploy.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Check if already seeded
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("✅ Database already seeded, skipping.");
    return;
  }

  console.log("🌱 Seeding database...");

  const roles = await Promise.all([
    prisma.role.create({ data: { name: "SUPER_ADMIN", description: "Administrador del sistema", permissions: JSON.stringify(["*"]) } }),
    prisma.role.create({ data: { name: "ADMIN_EMPRESA", description: "Administrador de empresa", permissions: JSON.stringify(["company.*", "user.read", "voucher.*", "report.*"]) } }),
    prisma.role.create({ data: { name: "CONTABILIDAD", description: "Contador", permissions: JSON.stringify(["voucher.*", "report.read"]) } }),
    prisma.role.create({ data: { name: "TESORERIA", description: "Tesorero", permissions: JSON.stringify(["voucher.read", "account.*", "detraction.*"]) } }),
    prisma.role.create({ data: { name: "GERENCIA", description: "Gerente", permissions: JSON.stringify(["*.read", "report.*"]) } }),
    prisma.role.create({ data: { name: "AUDITOR", description: "Auditor", permissions: JSON.stringify(["*.read"]) } }),
  ]);

  const hashedPassword = await bcrypt.hash("password123", 10);

  const user1 = await prisma.user.create({
    data: { email: "carlos.mendoza@corpandina.com", password: hashedPassword, nombre: "Carlos Mendoza" },
  });

  const user2 = await prisma.user.create({
    data: { email: "admin@sunat.com", password: hashedPassword, nombre: "Admin Sistema" },
  });

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

  await prisma.userCompanyRole.create({
    data: { userId: user1.id, companyId: company.id, roleId: roles.find(r => r.name === "ADMIN_EMPRESA")!.id },
  });

  await prisma.userCompanyRole.create({
    data: { userId: user2.id, companyId: company.id, roleId: roles.find(r => r.name === "SUPER_ADMIN")!.id },
  });

  console.log("✅ Seed completed!");
  console.log("📧 Login: carlos.mendoza@corpandina.com / password123");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
