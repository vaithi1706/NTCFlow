"use client";

import { FileIcon } from "./file-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { GitBranch, Layers, Sparkles } from "lucide-react";

interface DocumentCardProps {
  document: any;
  onClick: () => void;
}

export function DocumentCard({ document, onClick }: DocumentCardProps) {
  const tags = document.tags?.map((t: any) => t.tag) || [];
  const displayTags = tags.slice(0, 3);
  const extraTags = tags.length - 3;
  const version = document.currentVersion;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-3 p-4 rounded-lg border border-border bg-card",
        "hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all cursor-pointer"
      )}
    >
      {/* File Icon + Type */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted/50">
            <FileIcon fileType={document.fileType} size="lg" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium truncate leading-tight">{document.title}</h3>
            {version && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {version.fileName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Category */}
      {document.category && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: document.category.color }} />
          <span className="text-[11px] text-muted-foreground truncate">
            {document.category.parent && `${document.category.parent.name} / `}
            {document.category.name}
          </span>
        </div>
      )}

      {/* Tags */}
      {displayTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {displayTags.map((tag: any) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 border-0"
              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            >
              {tag.name}
            </Badge>
          ))}
          {extraTags > 0 && (
            <span className="text-[10px] text-muted-foreground">+{extraTags}</span>
          )}
        </div>
      )}

      {/* AI Similarity */}
      {document.similarity && (
        <div className="flex items-center gap-1.5 text-[11px] text-violet-400">
          <Sparkles className="h-3 w-3" />
          <span>{Math.round(document.similarity * 100)}% match</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">
            v{document.totalVersions}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
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
    </div>
  );
}
