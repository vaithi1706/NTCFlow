import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(50000).optional(),
  priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional().default("none"),
  columnId: z.string().uuid(),
  projectId: z.string().uuid(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  estimateMinutes: z.number().int().min(0).optional(),
  storyPoints: z.number().int().min(0).max(100).optional(),
  parentTaskId: z.string().uuid().optional(),
});

export const updateTaskSchema = createTaskSchema.partial().omit({
  projectId: true,
});

export const moveTaskSchema = z.object({
  taskId: z.string().uuid(),
  columnId: z.string().uuid(),
  position: z.number().int().min(0),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
