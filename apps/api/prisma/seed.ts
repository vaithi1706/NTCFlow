import { PrismaClient, Priority, TaskStatus, ProjectRole, WorkspaceRole, NotificationType, DependencyType } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Bcrypt hash for "Password1!" (12 rounds)
const PASSWORD_HASH = '$2a$12$TrZMakQUBdgexUKCpBgLAutuzK0KisiMGJ5CNudIjXgK1hDeWO7V2';

async function main() {
  console.log('🌱 Seeding DKFlow database...\n');

  // ─── USERS ────────────────────────────────────────
  const alice = await prisma.user.create({
    data: {
      email: 'alice.chen@dkflow.com',
      passwordHash: PASSWORD_HASH,
      name: 'Alice Chen',
      role: 'admin',
      emailVerified: true,
      theme: 'dark',
      timezone: 'America/New_York',
      notificationPreferences: { email: true, push: true, digest: 'daily' },
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob.martinez@dkflow.com',
      passwordHash: PASSWORD_HASH,
      name: 'Bob Martinez',
      role: 'user',
      emailVerified: true,
      theme: 'light',
      timezone: 'America/Los_Angeles',
    },
  });

  const carol = await prisma.user.create({
    data: {
      email: 'carol.nguyen@dkflow.com',
      passwordHash: PASSWORD_HASH,
      name: 'Carol Nguyen',
      role: 'user',
      emailVerified: true,
      theme: 'system',
      timezone: 'Europe/London',
    },
  });

  const dave = await prisma.user.create({
    data: {
      email: 'dave.patel@dkflow.com',
      passwordHash: PASSWORD_HASH,
      name: 'Dave Patel',
      role: 'user',
      emailVerified: true,
      timezone: 'Asia/Kolkata',
    },
  });

  console.log('✅ Created 4 users');

  // ─── WORKSPACE ────────────────────────────────────
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Acme Engineering',
      slug: 'acme-engineering',
      description: 'Engineering team workspace for Acme Corp',
      ownerId: alice.id,
    },
  });

  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId: workspace.id, userId: alice.id, role: 'owner' },
      { workspaceId: workspace.id, userId: bob.id, role: 'admin' },
      { workspaceId: workspace.id, userId: carol.id, role: 'member' },
      { workspaceId: workspace.id, userId: dave.id, role: 'member' },
    ],
  });

  console.log('✅ Created workspace with 4 members');

  // ─── PROJECTS ─────────────────────────────────────
  const webApp = await prisma.project.create({
    data: {
      name: 'Web Application Redesign',
      description: 'Complete redesign of the customer-facing web application with modern UI/UX',
      color: '#3B82F6',
      icon: '🌐',
      workspaceId: workspace.id,
      ownerId: alice.id,
      slug: 'web-app-redesign',
      taskPrefix: 'WEB',
      defaultPriority: 'medium',
      estimationType: 'story_points',
    },
  });

  const mobileApp = await prisma.project.create({
    data: {
      name: 'Mobile App v2',
      description: 'React Native mobile application for iOS and Android',
      color: '#22C55E',
      icon: '📱',
      workspaceId: workspace.id,
      ownerId: bob.id,
      slug: 'mobile-app-v2',
      taskPrefix: 'MOB',
      estimationType: 'hours',
    },
  });

  const infraProject = await prisma.project.create({
    data: {
      name: 'Infrastructure & DevOps',
      description: 'CI/CD pipeline, monitoring, and cloud infrastructure improvements',
      color: '#F59E0B',
      icon: '⚙️',
      workspaceId: workspace.id,
      ownerId: carol.id,
      slug: 'infra-devops',
      taskPrefix: 'INF',
    },
  });

  // Add project members
  await prisma.projectMember.createMany({
    data: [
      { projectId: webApp.id, userId: alice.id, role: 'lead' },
      { projectId: webApp.id, userId: bob.id, role: 'member' },
      { projectId: webApp.id, userId: carol.id, role: 'member' },
      { projectId: webApp.id, userId: dave.id, role: 'viewer' },
      { projectId: mobileApp.id, userId: bob.id, role: 'lead' },
      { projectId: mobileApp.id, userId: alice.id, role: 'member' },
      { projectId: mobileApp.id, userId: dave.id, role: 'member' },
      { projectId: infraProject.id, userId: carol.id, role: 'lead' },
      { projectId: infraProject.id, userId: dave.id, role: 'member' },
    ],
  });

  console.log('✅ Created 3 projects with members');

  // ─── BOARD COLUMNS ────────────────────────────────
  const columns: Record<string, any> = {};
  for (const proj of [webApp, mobileApp, infraProject]) {
    const cols = await Promise.all(
      ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'].map((name, i) =>
        prisma.boardColumn.create({
          data: {
            projectId: proj.id,
            name,
            position: i,
            isDone: name === 'Done',
            wipLimit: name === 'In Progress' ? 5 : name === 'In Review' ? 3 : null,
            color: name === 'Done' ? '#22C55E' : name === 'In Progress' ? '#3B82F6' : null,
          },
        })
      )
    );
    columns[proj.id] = cols;
  }

  console.log('✅ Created board columns for all projects');

  // ─── LABELS ───────────────────────────────────────
  const labelData = [
    { name: 'Bug', color: '#EF4444' },
    { name: 'Feature', color: '#3B82F6' },
    { name: 'Enhancement', color: '#8B5CF6' },
    { name: 'Documentation', color: '#6B7280' },
    { name: 'Performance', color: '#F59E0B' },
    { name: 'Security', color: '#DC2626' },
    { name: 'UX/UI', color: '#EC4899' },
  ];

  const labels: Record<string, any[]> = {};
  for (const proj of [webApp, mobileApp, infraProject]) {
    labels[proj.id] = await Promise.all(
      labelData.map((l) =>
        prisma.label.create({ data: { ...l, projectId: proj.id } })
      )
    );
  }

  console.log('✅ Created labels');

  // ─── TASKS (Web App project — realistic sample) ──
  const webCols = columns[webApp.id];
  const webLabels = labels[webApp.id];
  let taskNum = 0;

  const tasks = await Promise.all([
    // Backlog
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[0].id, title: 'Research accessibility audit tools',
        taskNumber: ++taskNum, status: 'backlog', priority: 'low', position: 0,
        description: 'Evaluate WAVE, axe, and Lighthouse for automated a11y testing. Need to pick one for CI pipeline.',
        createdById: alice.id, storyPoints: 3,
      },
    }),
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[0].id, title: 'Design dark mode color tokens',
        taskNumber: ++taskNum, status: 'backlog', priority: 'medium', position: 1,
        description: 'Create a complete set of dark mode design tokens following WCAG contrast guidelines.',
        createdById: carol.id, storyPoints: 5,
      },
    }),
    // To Do
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[1].id, title: 'Implement user authentication flow',
        taskNumber: ++taskNum, status: 'todo', priority: 'urgent', position: 0,
        description: 'Build login, registration, forgot password, and email verification pages with proper validation.',
        createdById: alice.id, assigneeId: bob.id, storyPoints: 13,
        dueDate: new Date('2026-02-28'),
      },
    }),
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[1].id, title: 'Set up Prisma schema and migrations',
        taskNumber: ++taskNum, status: 'todo', priority: 'high', position: 1,
        createdById: alice.id, assigneeId: carol.id, storyPoints: 8,
        dueDate: new Date('2026-02-20'),
      },
    }),
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[1].id, title: 'Create API error handling middleware',
        taskNumber: ++taskNum, status: 'todo', priority: 'high', position: 2,
        createdById: bob.id, assigneeId: bob.id, storyPoints: 5,
      },
    }),
    // In Progress
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[2].id, title: 'Build sidebar navigation component',
        taskNumber: ++taskNum, status: 'in_progress', priority: 'high', position: 0,
        description: 'Collapsible sidebar with project list, favorites, and workspace switcher. Must support keyboard nav.',
        createdById: alice.id, assigneeId: alice.id, storyPoints: 8,
        startDate: new Date('2026-02-14'),
        dueDate: new Date('2026-02-21'),
        estimateHours: 16,
        timeSpent: 6,
      },
    }),
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[2].id, title: 'Implement drag-and-drop kanban board',
        taskNumber: ++taskNum, status: 'in_progress', priority: 'urgent', position: 1,
        description: 'Using @dnd-kit, build the core kanban board with smooth animations, column reordering, and cross-column task movement.',
        createdById: alice.id, assigneeId: dave.id, storyPoints: 13,
        startDate: new Date('2026-02-13'),
        dueDate: new Date('2026-02-25'),
        estimateHours: 24,
        timeSpent: 10,
      },
    }),
    // In Review
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[3].id, title: 'Configure Turborepo monorepo structure',
        taskNumber: ++taskNum, status: 'in_review', priority: 'medium', position: 0,
        createdById: carol.id, assigneeId: carol.id, storyPoints: 5,
        startDate: new Date('2026-02-10'),
      },
    }),
    // Done
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[4].id, title: 'Initialize Next.js 15 with App Router',
        taskNumber: ++taskNum, status: 'done', priority: 'high', position: 0,
        createdById: alice.id, assigneeId: alice.id, storyPoints: 3,
        completedAt: new Date('2026-02-12'),
      },
    }),
    prisma.task.create({
      data: {
        projectId: webApp.id, columnId: webCols[4].id, title: 'Set up Tailwind 4 + shadcn/ui',
        taskNumber: ++taskNum, status: 'done', priority: 'medium', position: 1,
        createdById: alice.id, assigneeId: bob.id, storyPoints: 2,
        completedAt: new Date('2026-02-13'),
      },
    }),
  ]);

  // Update project task counter
  await prisma.project.update({ where: { id: webApp.id }, data: { taskCounter: taskNum } });

  console.log(`✅ Created ${tasks.length} tasks for Web App project`);

  // ─── TASK ASSIGNEES (multi-assign) ────────────────
  await prisma.taskAssignee.createMany({
    data: [
      { taskId: tasks[6].id, userId: alice.id },
      { taskId: tasks[6].id, userId: dave.id },
      { taskId: tasks[5].id, userId: alice.id },
    ],
  });

  // ─── TASK LABELS ──────────────────────────────────
  await prisma.taskLabel.createMany({
    data: [
      { taskId: tasks[2].id, labelId: webLabels[1].id }, // auth = Feature
      { taskId: tasks[2].id, labelId: webLabels[5].id }, // auth = Security
      { taskId: tasks[5].id, labelId: webLabels[6].id }, // sidebar = UX/UI
      { taskId: tasks[6].id, labelId: webLabels[1].id }, // kanban = Feature
      { taskId: tasks[6].id, labelId: webLabels[6].id }, // kanban = UX/UI
      { taskId: tasks[7].id, labelId: webLabels[3].id }, // turborepo = Documentation
    ],
  });

  // ─── TASK DEPENDENCIES ────────────────────────────
  await prisma.taskDependency.create({
    data: {
      taskId: tasks[2].id, // auth flow
      dependsOnId: tasks[3].id, // blocked by prisma schema
      dependencyType: 'blocked_by',
    },
  });

  // ─── CHECKLISTS ───────────────────────────────────
  const checklist = await prisma.checklist.create({
    data: {
      taskId: tasks[2].id,
      title: 'Auth Implementation Checklist',
      position: 0,
    },
  });

  await prisma.checklistItem.createMany({
    data: [
      { checklistId: checklist.id, content: 'Login page with email/password', isChecked: false, position: 0 },
      { checklistId: checklist.id, content: 'Registration with email verification', isChecked: false, position: 1 },
      { checklistId: checklist.id, content: 'Forgot password flow', isChecked: false, position: 2 },
      { checklistId: checklist.id, content: 'JWT access + refresh tokens', isChecked: true, position: 3 },
      { checklistId: checklist.id, content: 'Rate limiting on auth endpoints', isChecked: false, position: 4 },
    ],
  });

  console.log('✅ Created checklists');

  // ─── COMMENTS ─────────────────────────────────────
  const comment1 = await prisma.comment.create({
    data: {
      taskId: tasks[6].id,
      userId: alice.id,
      content: '<p>I\'ve been looking at @dnd-kit examples. The sortable preset handles most of our use case. We should use <code>DndContext</code> with <code>SortableContext</code> per column.</p>',
    },
  });

  const comment2 = await prisma.comment.create({
    data: {
      taskId: tasks[6].id,
      userId: dave.id,
      content: '<p>Agreed. I\'ll start with the basic board layout and add drag-and-drop incrementally. Should we support touch devices from the start?</p>',
      parentId: comment1.id,
    },
  });

  await prisma.comment.create({
    data: {
      taskId: tasks[6].id,
      userId: alice.id,
      content: '<p>Yes, @dnd-kit has built-in touch sensor support. Let\'s enable it from day one. Also add keyboard sensor for a11y.</p>',
      parentId: comment1.id,
    },
  });

  // Comment mentions
  await prisma.commentMention.create({
    data: { commentId: comment2.id, userId: alice.id },
  });

  // Comment reactions
  await prisma.commentReaction.createMany({
    data: [
      { commentId: comment1.id, userId: bob.id, emoji: '👍' },
      { commentId: comment1.id, userId: carol.id, emoji: '👍' },
      { commentId: comment2.id, userId: alice.id, emoji: '✅' },
    ],
  });

  console.log('✅ Created comments, mentions, reactions');

  // ─── SPRINTS ──────────────────────────────────────
  const sprint = await prisma.sprint.create({
    data: {
      projectId: webApp.id,
      name: 'Sprint 1 — Foundation',
      goal: 'Set up project infrastructure, auth, and core navigation components',
      startDate: new Date('2026-02-10'),
      endDate: new Date('2026-02-24'),
      isActive: true,
    },
  });

  await prisma.sprintTask.createMany({
    data: [
      { sprintId: sprint.id, taskId: tasks[2].id },
      { sprintId: sprint.id, taskId: tasks[3].id },
      { sprintId: sprint.id, taskId: tasks[5].id },
      { sprintId: sprint.id, taskId: tasks[6].id },
      { sprintId: sprint.id, taskId: tasks[7].id },
      { sprintId: sprint.id, taskId: tasks[8].id },
      { sprintId: sprint.id, taskId: tasks[9].id },
    ],
  });

  console.log('✅ Created sprint with tasks');

  // ─── NOTIFICATIONS ────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        userId: bob.id,
        type: 'task_assigned',
        title: 'You were assigned to WEB-3',
        message: 'Alice Chen assigned you to "Implement user authentication flow"',
        linkUrl: `/projects/${webApp.id}/tasks/${tasks[2].id}`,
        isRead: false,
      },
      {
        userId: dave.id,
        type: 'task_assigned',
        title: 'You were assigned to WEB-7',
        message: 'Alice Chen assigned you to "Implement drag-and-drop kanban board"',
        linkUrl: `/projects/${webApp.id}/tasks/${tasks[6].id}`,
        isRead: true,
        readAt: new Date('2026-02-14'),
      },
      {
        userId: alice.id,
        type: 'task_commented',
        title: 'Dave Patel commented on WEB-7',
        message: 'Dave Patel replied to your comment on "Implement drag-and-drop kanban board"',
        linkUrl: `/projects/${webApp.id}/tasks/${tasks[6].id}`,
        isRead: false,
      },
    ],
  });

  console.log('✅ Created notifications');

  // ─── ACTIVITIES ───────────────────────────────────
  await prisma.activity.createMany({
    data: [
      { projectId: webApp.id, userId: alice.id, entityType: 'project', entityId: webApp.id, action: 'created', description: 'created the project' },
      { projectId: webApp.id, userId: alice.id, entityType: 'task', entityId: tasks[8].id, action: 'completed', description: 'marked "Initialize Next.js 15 with App Router" as done' },
      { projectId: webApp.id, userId: alice.id, entityType: 'sprint', entityId: sprint.id, action: 'started', description: 'started "Sprint 1 — Foundation"' },
      { projectId: webApp.id, userId: dave.id, entityType: 'task', entityId: tasks[6].id, action: 'status_changed', description: 'moved "Implement drag-and-drop kanban board" to In Progress', metadata: { from: 'todo', to: 'in_progress' } },
    ],
  });

  console.log('✅ Created activities');

  // ─── SAVED FILTERS ────────────────────────────────
  await prisma.savedFilter.create({
    data: {
      projectId: webApp.id,
      userId: alice.id,
      name: 'My Urgent Tasks',
      filters: { priority: ['urgent', 'high'], assignee: 'me', status: ['todo', 'in_progress'] },
      isShared: true,
    },
  });

  // ─── AUTOMATION RULES ─────────────────────────────
  await prisma.automationRule.create({
    data: {
      projectId: webApp.id,
      name: 'Auto-assign reviewer on Done',
      description: 'When a task moves to "In Review", notify the project lead',
      trigger: { event: 'task.moved', conditions: { toColumn: 'In Review' } },
      actions: [{ type: 'notify', params: { role: 'lead' } }],
      isEnabled: true,
    },
  });

  // ─── PROJECT TEMPLATES ────────────────────────────
  await prisma.projectTemplate.createMany({
    data: [
      {
        name: 'Agile Sprint Board',
        description: 'Kanban board with sprint management for agile teams',
        category: 'Engineering',
        isSystem: true,
        config: {
          columns: ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'],
          labels: ['Bug', 'Feature', 'Enhancement', 'Tech Debt'],
          estimation: 'story_points',
        },
      },
      {
        name: 'Bug Tracking',
        description: 'Track and prioritize bugs with severity levels',
        category: 'Engineering',
        isSystem: true,
        config: {
          columns: ['Reported', 'Triaged', 'In Progress', 'Testing', 'Resolved'],
          labels: ['Critical', 'Major', 'Minor', 'Cosmetic', 'Regression'],
          estimation: 'none',
        },
      },
      {
        name: 'Product Launch',
        description: 'Plan and execute a product launch from start to finish',
        category: 'Marketing',
        isSystem: true,
        config: {
          columns: ['Planning', 'In Progress', 'Ready for Launch', 'Launched', 'Post-Launch'],
          labels: ['Content', 'Design', 'Engineering', 'Marketing', 'Legal'],
          estimation: 'hours',
        },
      },
    ],
  });

  console.log('✅ Created templates, filters, automation rules');

  // ─── TASK WATCHERS ────────────────────────────────
  await prisma.taskWatcher.createMany({
    data: [
      { taskId: tasks[2].id, userId: alice.id },
      { taskId: tasks[6].id, userId: alice.id },
      { taskId: tasks[6].id, userId: bob.id },
    ],
  });

  // ─── SUMMARY ──────────────────────────────────────
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.project.count(),
    prisma.boardColumn.count(),
    prisma.task.count(),
    prisma.comment.count(),
    prisma.label.count(),
    prisma.sprint.count(),
    prisma.notification.count(),
    prisma.projectTemplate.count(),
  ]);

  console.log('\n📊 Seed Summary:');
  console.log(`   Users: ${counts[0]}`);
  console.log(`   Workspaces: ${counts[1]}`);
  console.log(`   Projects: ${counts[2]}`);
  console.log(`   Board Columns: ${counts[3]}`);
  console.log(`   Tasks: ${counts[4]}`);
  console.log(`   Comments: ${counts[5]}`);
  console.log(`   Labels: ${counts[6]}`);
  console.log(`   Sprints: ${counts[7]}`);
  console.log(`   Notifications: ${counts[8]}`);
  console.log(`   Templates: ${counts[9]}`);
  console.log('\n🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
