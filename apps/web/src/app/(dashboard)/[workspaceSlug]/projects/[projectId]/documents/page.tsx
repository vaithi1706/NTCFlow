"use client";

import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { DocumentBrowser } from "@/components/documents/document-browser";
import { trpc } from "@/lib/api/trpc";

export default function DocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;

  const { data: project } = trpc.project.getById.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  const breadcrumbs = [
    { label: "DKFlow", href: "/home" },
    { label: project?.name || "Project" },
    { label: "Documents" },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={breadcrumbs}
        showViewSwitcher
        currentView="documents"
        onViewChange={handleViewChange}
      />
      <div className="flex-1 overflow-hidden">
        <DocumentBrowser projectId={projectId} />
      </div>
    </div>
  );
}
