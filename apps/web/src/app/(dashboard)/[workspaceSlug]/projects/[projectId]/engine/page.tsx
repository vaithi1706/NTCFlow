"use client";

import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { EngineDashboard } from "@/components/ai/engine-dashboard";
import { useProjectData } from "@/hooks/use-project-data";

export default function EnginePage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { project } = useProjectData(projectId);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Intelligence Engine" icon="🧠" />
      <div className="flex-1 overflow-auto">
        {project?.workspaceId ? (
          <EngineDashboard workspaceId={project.workspaceId} projectId={projectId} />
        ) : (
          <div className="p-6 text-center text-muted-foreground">Loading...</div>
        )}
      </div>
    </div>
  );
}
