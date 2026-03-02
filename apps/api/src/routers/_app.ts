import { router } from "../trpc.js";
import { authRouter } from "./auth.router.js";
import { workspaceRouter } from "./workspace.router.js";
import { projectRouter } from "./project.router.js";
import { boardRouter } from "./board.router.js";
import { taskRouter } from "./task.router.js";
import { commentRouter } from "./comment.router.js";
import { labelRouter } from "./label.router.js";
import { checklistRouter } from "./checklist.router.js";
import { notificationRouter } from "./notification.router.js";
import { uploadRouter } from "./upload.router.js";
import { sprintRouter } from "./sprint.router.js";
import { activityRouter } from "./activity.router.js";
import { automationRouter } from "./automation.router.js";
import { savedFilterRouter } from "./savedFilter.router.js";
import { statsRouter } from "./stats.router.js";
import { searchRouter } from "./search.router.js";
import { aiRouter } from "./ai.router.js";
import { teamRouter } from "./team.router.js";
import { invitationRouter } from "./invitation.router.js";
import { customFieldRouter } from "./customField.router.js";
import { roleRouter } from "./role.router.js";
import { workflowRouter } from "./workflow.router.js";
import { versionRouter } from "./version.router.js";
import { timeTrackingRouter } from "./timeTracking.router.js";
import { auditRouter } from "./audit.router.js";
import { gitRouter } from "./git.router.js";
import { webhookRouter } from "./webhook.router.js";
import { apiKeyRouter } from "./apiKey.router.js";
import { dashboardRouter } from "./dashboard.router.js";
import { integrationRouter } from "./integration.router.js";
import { portfolioRouter } from "./portfolio.router.js";
import { formRouter } from "./form.router.js";
import { taskTemplateRouter } from "./taskTemplate.router.js";
import { subscriptionRouter } from "./subscription.router.js";
import { adminRouter } from "./admin.router.js";
import { goalRouter } from "./goal.router.js";
import { approvalRouter } from "./approval.router.js";
import { workloadRouter } from "./workload.router.js";
import { slaRouter } from "./sla.router.js";
import { sprintChartRouter } from "./sprintChart.router.js";
import { waitlistRouter } from "./waitlist.router.js";
import { reportRouter } from "./report.router.js";
import { crossProjectRouter } from "./crossProject.router.js";
import { resourcePlanningRouter } from "./resourcePlanning.router.js";
import { engineRouter } from "./engine.router.js";
import { documentRouter } from "./document.router.js";

export const appRouter = router({
  auth: authRouter,
  workspace: workspaceRouter,
  project: projectRouter,
  board: boardRouter,
  task: taskRouter,
  comment: commentRouter,
  label: labelRouter,
  checklist: checklistRouter,
  notification: notificationRouter,
  upload: uploadRouter,
  sprint: sprintRouter,
  activity: activityRouter,
  automation: automationRouter,
  savedFilter: savedFilterRouter,
  stats: statsRouter,
  search: searchRouter,
  ai: aiRouter,
  team: teamRouter,
  invitation: invitationRouter,
  customField: customFieldRouter,
  role: roleRouter,
  workflow: workflowRouter,
  version: versionRouter,
  timeTracking: timeTrackingRouter,
  audit: auditRouter,
  git: gitRouter,
  webhook: webhookRouter,
  apiKey: apiKeyRouter,
  dashboard: dashboardRouter,
  integration: integrationRouter,
  portfolio: portfolioRouter,
  form: formRouter,
  taskTemplate: taskTemplateRouter,
  subscription: subscriptionRouter,
  admin: adminRouter,
  goal: goalRouter,
  approval: approvalRouter,
  workload: workloadRouter,
  sprintChart: sprintChartRouter,
  sla: slaRouter,
  waitlist: waitlistRouter,
  report: reportRouter,
  crossProject: crossProjectRouter,
  resourcePlanning: resourcePlanningRouter,
  engine: engineRouter,
  document: documentRouter,
});

export type AppRouter = typeof appRouter;
