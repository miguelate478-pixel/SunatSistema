/**
 * Staging seed — minimal data for testing
 * Creates roles + 1 admin user only. No demo vouchers.
 *
 * Run: DATABASE_URL=... npx tsx prisma/seed.staging.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting staging seed...");

  // Upsert roles (safe to run multiple times)
  const roleNames = [
    { name: "SUPER_ADMIN", description: "Administrador del sistema", permissions: JSON.stringify(["*"]) },
    { name: "ADMIN_EMPRESA", description: "Administrador de empresa", permissions: JSON.stringify(["company.*", "voucher.*", "report.*"]) },
    { name: "CONTABILIDAD", description: "Contador", permissions: JSON.stringify(["voucher.*", "report.read"]) },
    { name: "TESORERIA", description: "Tesorero", permissions: JSON.stringify(["voucher.read", "account.*", "detraction.*"]) },
    { name: "GERENCIA", description: "Gerente", permissions: JSON.stringify(["*.read", "report.*"]) },
    { name: "AUDITOR", description: "Auditor", permissions: JSON.stringify(["*.read"]) },
  ];

  for (const role of roleNames) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log("✅ Roles upserted");

  // Create staging admin user (change password after first login)
  const stagingPassword = process.env.STAGING_ADMIN_PASSWORD ?? "ChangeMe123!";
  const hashedPassword = await bcrypt.hash(stagingPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@staging.controlsunat.com" },
    update: {},
    create: {
      email: "admin@staging.controlsunat.com",
      password: hashedPassword,
      nombre: "Admin Staging",
    },
  });

  console.log("✅ Staging admin user created");
  console.log(`   Email: admin@staging.controlsunat.com`);
  console.log(`   Password: ${stagingPassword}`);
  console.log("   ⚠️  Change this password immediately after first login!");

  // Create a staging company
  const company = await prisma.company.upsert({
    where: { ruc: "20000000001" },
    update: {},
    create: {
      ruc: "20000000001",
      razonSocial: "EMPRESA STAGING S.A.C.",
      nombreComercial: "Staging Corp",
      sector: "Tecnología",
      plan: "PROFESSIONAL",
      createdById: adminUser.id,
    },
  });

  const adminRole = await prisma.role.findUnique({ where: { name: "SUPER_ADMIN" } });
  if (adminRole) {
    await prisma.userCompanyRole.upsert({
      where: { userId_companyId_roleId: { userId: adminUser.id, companyId: company.id, roleId: adminRole.id } },
      update: {},
      create: { userId: adminUser.id, companyId: company.id, roleId: adminRole.id },
    });
  }

  console.log("✅ Staging company and role assigned");
  console.log("🎉 Staging seed completed");
}

main()
  .catch((e) => { console.error("❌ Staging seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
