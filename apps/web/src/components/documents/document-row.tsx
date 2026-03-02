"use client";

import { FileIcon } from "./file-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { GitBranch, Link2 } from "lucide-react";

interface DocumentRowProps {
  document: any;
  onClick: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentRow({ document, onClick }: DocumentRowProps) {
  const tags = document.tags?.map((t: any) => t.tag) || [];
  const version = document.currentVersion;

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 px-4 py-3 border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
    >
      {/* Icon */}
      <div className="p-1.5 rounded-md bg-muted/50 flex-shrink-0">
        <FileIcon fileType={document.fileType} size="md" />
      </div>

      {/* Title + filename */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{document.title}</p>
        {version && (
          <p className="text-xs text-muted-foreground truncate">{version.fileName}</p>
        )}
      </div>

      {/* Category */}
      <div className="hidden md:flex items-center gap-1.5 flex-shrink-0 w-32">
        {document.category ? (
          <>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: document.category.color }} />
            <span className="text-xs text-muted-foreground truncate">
              {document.category.name}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground/40">--</span>
        )}
      </div>

      {/* Tags */}
      <div className="hidden lg:flex items-center gap-1 flex-shrink-0 max-w-[200px]">
        {tags.slice(0, 2).map((tag: any) => (
          <Badge
            key={tag.id}
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 border-0"
            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
          >
            {tag.name}
          </Badge>
        ))}
        {tags.length > 2 && (
          <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>
        )}
      </div>

      {/* Version */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 w-12">
        <GitBranch className="h-3 w-3" />
        v{document.totalVersions}
      </div>

      {/* Size */}
      <div className="text-xs text-muted-foreground flex-shrink-0 w-16 text-right hidden lg:block">
        {version ? formatSize(version.fileSize) : "--"}
      </div>

      {/* Links */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 w-8">
        {document._count?.taskLinks > 0 && (
          <>
            <Link2 className="h-3 w-3" />
            {document._count.taskLinks}
          </>
        )}
      </div>

      {/* Updated */}
      <div className="flex items-center gap-1.5 flex-shrink-0 w-32 justify-end">
        <Avatar className="h-5 w-5">
          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
            {document.createdBy?.name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(document.updatedAt), { addSuffix: true })}
        </span>
      </div>
    </div>
  );
}
