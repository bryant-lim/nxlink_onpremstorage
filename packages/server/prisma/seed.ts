import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: hashedPassword,
      email: "admin@localhost",
      role: "admin",
      isActive: true,
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: Number(admin.id) },
    update: {},
    create: {
      userId: Number(admin.id),
      visibleColumns: JSON.stringify([
        "agentName",
        "caller",
        "callee",
        "direction",
        "callDuration",
        "callStatus",
        "startTime",
        "answered",
      ]),
      columnOrder: JSON.stringify(null),
      pageSize: 20,
    },
  });

  await prisma.schedulerConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      cronExpression: "0 */6 * * *",
      lookbackHours: 24,
      pageSize: 100,
      storagePath: "./recordings",
      isActive: false,
    },
  });

  console.log("Seed completed:");
  console.log("  - Admin user: admin / admin123");
  console.log("  - Default scheduler config created (disabled)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
