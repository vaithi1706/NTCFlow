import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_ROLES = [
  {
    name: "Owner",
    description: "Full control over the workspace",
    color: "#ef4444",
    isSystem: true,
    permissions: {
      canCreateProject: true, canDeleteProject: true, canManageMembers: true, canInviteMembers: true,
      canCreateTasks: true, canEditAnyTask: true, canDeleteTasks: true, canManageSprints: true,
      canManageBoard: true, canViewReports: true, canManageLabels: true, canManageAutomations: true,
      canAccessSettings: true, canExportData: true,
    },
  },
  {
    name: "Admin",
    description: "Everything except delete workspace",
    color: "#f97316",
    isSystem: true,
    permissions: {
      canCreateProject: true, canDeleteProject: true, canManageMembers: true, canInviteMembers: true,
      canCreateTasks: true, canEditAnyTask: true, canDeleteTasks: true, canManageSprints: true,
      canManageBoard: true, canViewReports: true, canManageLabels: true, canManageAutomations: true,
      canAccessSettings: true, canExportData: true,
    },
  },
  {
    name: "Project Manager",
    description: "Manage projects, sprints, boards, members, reports",
    color: "#eab308",
    isSystem: true,
    permissions: {
      canCreateProject: true, canDeleteProject: false, canManageMembers: true, canInviteMembers: true,
      canCreateTasks: true, canEditAnyTask: true, canDeleteTasks: true, canManageSprints: true,
      canManageBoard: true, canViewReports: true, canManageLabels: true, canManageAutomations: false,
      canAccessSettings: false, canExportData: true,
    },
  },
  {
    name: "Scrum Master",
    description: "Manage sprints, boards, assign tasks",
    color: "#22c55e",
    isSystem: true,
    permissions: {
      canCreateProject: false, canDeleteProject: false, canManageMembers: false, canInviteMembers: false,
      canCreateTasks: true, canEditAnyTask: true, canDeleteTasks: false, canManageSprints: true,
      canManageBoard: true, canViewReports: true, canManageLabels: false, canManageAutomations: false,
      canAccessSettings: false, canExportData: false,
    },
  },
  {
    name: "Product Owner",
    description: "Create epics/stories, manage backlog, view reports",
    color: "#06b6d4",
    isSystem: true,
    permissions: {
      canCreateProject: false, canDeleteProject: false, canManageMembers: false, canInviteMembers: false,
      canCreateTasks: true, canEditAnyTask: true, canDeleteTasks: false, canManageSprints: false,
      canManageBoard: false, canViewReports: true, canManageLabels: true, canManageAutomations: false,
      canAccessSettings: false, canExportData: true,
    },
  },
  {
    name: "Developer",
    description: "Create/edit tasks, log time, comment",
    color: "#3b82f6",
    isSystem: true,
    permissions: {
      canCreateProject: false, canDeleteProject: false, canManageMembers: false, canInviteMembers: false,
      canCreateTasks: true, canEditAnyTask: false, canDeleteTasks: false, canManageSprints: false,
      canManageBoard: false, canViewReports: false, canManageLabels: false, canManageAutomations: false,
      canAccessSettings: false, canExportData: false,
    },
  },
  {
    name: "Designer",
    description: "Create/edit tasks, upload files, comment",
    color: "#8b5cf6",
    isSystem: true,
    permissions: {
      canCreateProject: false, canDeleteProject: false, canManageMembers: false, canInviteMembers: false,
      canCreateTasks: true, canEditAnyTask: false, canDeleteTasks: false, canManageSprints: false,
      canManageBoard: false, canViewReports: false, canManageLabels: false, canManageAutomations: false,
      canAccessSettings: false, canExportData: false,
    },
  },
  {
    name: "QA / Tester",
    description: "Create bugs, update status, comment",
    color: "#ec4899",
    isSystem: true,
    permissions: {
      canCreateProject: false, canDeleteProject: false, canManageMembers: false, canInviteMembers: false,
      canCreateTasks: true, canEditAnyTask: false, canDeleteTasks: false, canManageSprints: false,
      canManageBoard: false, canViewReports: false, canManageLabels: false, canManageAutomations: false,
      canAccessSettings: false, canExportData: false,
    },
  },
  {
    name: "Business Analyst",
    description: "Create stories, view reports, comment",
    color: "#14b8a6",
    isSystem: true,
    permissions: {
      canCreateProject: false, canDeleteProject: false, canManageMembers: false, canInviteMembers: false,
      canCreateTasks: true, canEditAnyTask: false, canDeleteTasks: false, canManageSprints: false,
      canManageBoard: false, canViewReports: true, canManageLabels: false, canManageAutomations: false,
      canAccessSettings: false, canExportData: false,
    },
  },
  {
    name: "Viewer",
    description: "Read-only access",
    color: "#6b7280",
    isSystem: true,
    permissions: {
      canCreateProject: false, canDeleteProject: false, canManageMembers: false, canInviteMembers: false,
      canCreateTasks: false, canEditAnyTask: false, canDeleteTasks: false, canManageSprints: false,
      canManageBoard: false, canViewReports: false, canManageLabels: false, canManageAutomations: false,
      canAccessSettings: false, canExportData: false,
    },
  },
];

export { DEFAULT_ROLES };

async function seedRolesForWorkspace(workspaceId: string) {
  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { workspaceId_name: { workspaceId, name: role.name } },
      update: { permissions: role.permissions, color: role.color, description: role.description },
      create: { ...role, workspaceId },
    });
  }
  console.log(`Seeded ${DEFAULT_ROLES.length} roles for workspace ${workspaceId}`);
}

async function main() {
  // Seed for all existing workspaces
  const workspaces = await prisma.workspace.findMany({ select: { id: true, name: true } });
  for (const ws of workspaces) {
    await seedRolesForWorkspace(ws.id);
  }
  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
