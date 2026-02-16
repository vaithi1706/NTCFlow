export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string;
  theme: "light" | "dark" | "system";
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  notificationPreferences: NotificationPreferences;
}

export interface NotificationPreferences {
  taskAssigned: boolean;
  taskMentioned: boolean;
  taskDueSoon: boolean;
  taskOverdue: boolean;
  taskCommented: boolean;
  taskStatusChanged: boolean;
  emailDigest: "none" | "daily" | "weekly";
}

export interface Session {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  lastActive: string;
  createdAt: string;
}
