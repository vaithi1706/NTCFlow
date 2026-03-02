"use client";

import { trpc } from "@/lib/api/trpc";
import { FileIcon } from "./file-icon";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, ExternalLink, GitBranch } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useParams, useRouter } from "next/navigation";

interface TaskDocumentsProps {
  taskId: string;
  projectId: string;
}

export function TaskDocuments({ taskId, projectId }: TaskDocumentsProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug = params.workspaceSlug as string;

  const { data: links } = trpc.document.taskLink.list.useQuery(
    { documentId: "" },
    { enabled: false } // We'll use a different approach
  );

  // Use the task-side query
  const { data: docLinks } = trpc.document.listByTask.useQuery(
    { taskId },
    { enabled: !!taskId }
  );

  if (!docLinks || docLinks.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Linked Documents</h4>
        <span className="text-xs text-muted-foreground">({docLinks.length})</span>
      </div>
      <div className="space-y-1.5">
        {docLinks.map((doc: any) => (
          <div
            key={doc.id}
            className="group flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => {
              router.push(`/${workspaceSlug}/projects/${projectId}/documents`);
            }}
          >
            <FileIcon fileType={doc.fileType} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.title}</p>
              <p className="text-[11px] text-muted-foreground">
                v{doc.totalVersions} &middot; {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
              </p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>
    </div>
  );
}
