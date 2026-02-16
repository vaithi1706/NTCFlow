import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(5000).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  workspaceId: z.string().uuid(),
  taskIdPrefix: z.string().min(1).max(10).regex(/^[A-Z]+$/, "Prefix must be uppercase letters").optional(),
  defaultView: z.enum(["board", "list", "table"]).optional().default("board"),
});

export const updateProjectSchema = createProjectSchema.partial().omit({ workspaceId: true });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
