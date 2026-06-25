import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  // Dashboard
  {
    key: "dashboard:view",
    category: "dashboard",
    label: "View Dashboard",
    description: "Access the dashboard",
  },
  // Recordings
  {
    key: "recordings:view",
    category: "recordings",
    label: "View Recordings",
    description: "View the recordings list",
  },
  {
    key: "recordings:play",
    category: "recordings",
    label: "Play Recordings",
    description: "Play audio recordings",
  },
  {
    key: "recordings:export-csv",
    category: "recordings",
    label: "Export CSV",
    description: "Export recordings to CSV",
  },
  {
    key: "recordings:export-single",
    category: "recordings",
    label: "Export Single",
    description: "Export a single recording",
  },
  {
    key: "recordings:export-bulk",
    category: "recordings",
    label: "Export Bulk",
    description: "Bulk export recordings",
  },
  // Downloads
  {
    key: "downloads:view",
    category: "downloads",
    label: "View Downloads",
    description: "View download history",
  },
  // Agents
  {
    key: "agents:view",
    category: "agents",
    label: "View Agents",
    description: "View agents list",
  },
  {
    key: "agents:manage",
    category: "agents",
    label: "Manage Agents",
    description: "Create, edit, delete agents",
  },
  // Rules
  {
    key: "rules:view",
    category: "rules",
    label: "View Rules",
    description: "View download rules",
  },
  {
    key: "rules:manage",
    category: "rules",
    label: "Manage Rules",
    description: "Create, edit, delete rules",
  },
  // Reports
  {
    key: "reports:view",
    category: "reports",
    label: "View Reports",
    description: "View call statistics",
  },
  {
    key: "reports:audit-trail",
    category: "reports",
    label: "View Audit Trail",
    description: "View audit trail",
  },
  {
    key: "reports:playback",
    category: "reports",
    label: "View Playback History",
    description: "View playback history",
  },
  // Settings
  {
    key: "settings:view",
    category: "settings",
    label: "View Settings",
    description: "View settings page",
  },
  {
    key: "settings:api-config",
    category: "settings",
    label: "Edit API Config",
    description: "Edit API configuration",
  },
  {
    key: "settings:scheduler",
    category: "settings",
    label: "Manage Scheduler",
    description: "Manage scheduler configuration",
  },
  {
    key: "settings:sync",
    category: "settings",
    label: "Trigger Sync",
    description: "Trigger CDR sync",
  },
  {
    key: "settings:test-connection",
    category: "settings",
    label: "Test Connection",
    description: "Test API connection",
  },
  {
    key: "settings:encryption",
    category: "settings",
    label: "View Encryption",
    description: "View encryption status and configuration",
  },
  // Users
  {
    key: "users:view",
    category: "users",
    label: "View Users",
    description: "View users list",
  },
  {
    key: "users:manage",
    category: "users",
    label: "Manage Users",
    description: "Create, edit, delete users",
  },
];

const BUILTIN_ROLES = [
  {
    name: "admin",
    description: "Full access to all features",
    isSystem: true,
    permissions: ALL_PERMISSIONS.map((p) => p.key),
  },
  {
    name: "manager",
    description:
      "Manage recordings, rules, reports, settings (no user management, API config edit, or encryption)",
    isSystem: true,
    permissions: ALL_PERMISSIONS.filter(
      (p) =>
        p.key !== "users:manage" &&
        p.key !== "settings:api-config" &&
        p.key !== "settings:encryption",
    ).map((p) => p.key),
  },
  {
    name: "viewer",
    description: "View recordings, play audio, view reports",
    isSystem: true,
    permissions: [
      "dashboard:view",
      "recordings:view",
      "recordings:play",
      "downloads:view",
      "reports:view",
      "reports:playback",
    ],
  },
];

async function main() {
  // Create all permissions
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: perm,
    });
  }
  console.log(`Created ${ALL_PERMISSIONS.length} permissions`);

  // Create built-in roles with permissions
  for (const roleDef of BUILTIN_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: {
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      },
    });

    const perms = await prisma.permission.findMany({
      where: { key: { in: roleDef.permissions } },
    });

    for (const perm of perms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: Number(role.id),
            permissionId: Number(perm.id),
          },
        },
        update: {},
        create: {
          roleId: Number(role.id),
          permissionId: Number(perm.id),
        },
      });
    }

    console.log(
      `Role "${roleDef.name}" created with ${perms.length} permissions`,
    );
  }

  // Migrate existing users to the new role system
  const users = await prisma.user.findMany();
  for (const user of users) {
    const roleName = user.role || "viewer";
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (role) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: Number(user.id),
            roleId: Number(role.id),
          },
        },
        update: {},
        create: {
          userId: Number(user.id),
          roleId: Number(role.id),
        },
      });
      console.log(`Assigned role "${roleName}" to user "${user.username}"`);
    }
  }

  console.log("RBAC seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
