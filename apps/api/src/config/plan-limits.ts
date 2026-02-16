export const PLAN_LIMITS = {
  free: {
    maxProjects: 1,
    maxMembers: 3,
    maxTasks: 100,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    features: {
      ai: false,
      customFields: false,
      automations: false,
      integrations: false,
      apiKeys: false,
      webhooks: false,
      timeTracking: false,
      portfolio: false,
      advancedDashboard: false,
      ganttView: false,
      publicForms: false,
    },
  },
  pro: {
    maxProjects: Infinity,
    maxMembers: Infinity,
    maxTasks: Infinity,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    features: {
      ai: true,
      customFields: true,
      automations: true,
      integrations: true,
      apiKeys: true,
      webhooks: true,
      timeTracking: true,
      portfolio: true,
      advancedDashboard: true,
      ganttView: true,
      publicForms: true,
    },
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;
export type FeatureKey = keyof typeof PLAN_LIMITS.free.features;
export type LimitKey = "maxProjects" | "maxMembers" | "maxTasks" | "maxFileSize";

export const PRICING = {
  pro: {
    monthly: 15000, // paise = ₹150
    yearly: 150000, // paise = ₹1,500
    trialDays: 14,
  },
};
