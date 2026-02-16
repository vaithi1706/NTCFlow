import type { Priority } from "../constants/priorities.js";
import type { User } from "./user.js";

export interface Task {
  id: string;
  taskNumber: number;
  title: string;
  description: string | null;
  priority: Priority;
  position: number;
  columnId: string;
  projectId: string;
  parentTaskId: string | null;
  dueDate: string | null;
  startDate: string | null;
  estimateMinutes: number | null;
  timeSpentMinutes: number;
  storyPoints: number | null;
  isRecurring: boolean;
  isArchived: boolean;
  completedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskWithRelations extends Task {
  assignees: User[];
  labels: Label[];
  checklistProgress: { total: number; completed: number } | null;
  subtaskCount: number;
  commentCount: number;
  attachmentCount: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  projectId: string;
}

export interface Comment {
  id: string;
  content: string;
  taskId: string;
  authorId: string;
  author: User;
  parentCommentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Checklist {
  id: string;
  title: string;
  taskId: string;
  position: number;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  content: string;
  isCompleted: boolean;
  position: number;
  checklistId: string;
}
