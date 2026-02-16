export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  taskIdPrefix: string;
  taskCount: number;
  defaultView: "board" | "list" | "table";
  workspaceId: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumn {
  id: string;
  name: string;
  color: string | null;
  position: number;
  wipLimit: number | null;
  isDoneColumn: boolean;
  projectId: string;
}
