"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link2, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/api/trpc";

const LINK_TYPES = [
  { value: "blocks", label: "Blocks" },
  { value: "blocked_by", label: "Is blocked by" },
  { value: "relates_to", label: "Relates to" },
  { value: "duplicates", label: "Duplicates" },
  { value: "is_duplicated_by", label: "Is duplicated by" },
  { value: "clones", label: "Clones" },
  { value: "is_cloned_from", label: "Is cloned from" },
] as const;

const LINK_TYPE_LABELS: Record<string, string> = Object.fromEntries(LINK_TYPES.map((t) => [t.value, t.label]));

interface TaskLinksProps {
  taskId: string;
  projectId: string;
}

export function TaskLinks({ taskId, projectId }: TaskLinksProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [linkType, setLinkType] = useState<string>("relates_to");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data: links } = trpc.task.getLinks.useQuery({ taskId });
  const { data: searchResults } = trpc.task.list.useQuery(
    { projectId, search, limit: 10 },
    { enabled: addOpen && search.length > 0 }
  );

  const addLinkMutation = trpc.task.addLink.useMutation({
    onSuccess: () => {
      utils.task.getLinks.invalidate({ taskId });
      setAddOpen(false);
      setSearch("");
      toast.success("Link added");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeLinkMutation = trpc.task.removeLink.useMutation({
    onSuccess: () => {
      utils.task.getLinks.invalidate({ taskId });
      toast.success("Link removed");
    },
  });

  const outgoing = links?.outgoing || [];
  const incoming = links?.incoming || [];
  const allLinks = [
    ...outgoing.map((l) => ({
      id: l.id,
      type: l.dependencyType,
      task: l.dependsOn,
    })),
    ...incoming.map((l) => ({
      id: l.id,
      type: l.dependencyType === "blocks" ? "blocked_by" :
            l.dependencyType === "blocked_by" ? "blocks" :
            l.dependencyType === "duplicates" ? "is_duplicated_by" :
            l.dependencyType === "is_duplicated_by" ? "duplicates" :
            l.dependencyType === "clones" ? "is_cloned_from" :
            l.dependencyType === "is_cloned_from" ? "clones" :
            l.dependencyType,
      task: l.task,
    })),
  ];

  if (allLinks.length === 0 && !addOpen) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium flex-1">Links</h4>
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />Link task
        </Button>
        <LinkDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          linkType={linkType}
          setLinkType={setLinkType}
          search={search}
          setSearch={setSearch}
          searchResults={searchResults?.tasks}
          taskId={taskId}
          onAdd={(targetId) => addLinkMutation.mutate({ taskId, targetTaskId: targetId, linkType: linkType as any })}
          isPending={addLinkMutation.isPending}
        />
      </div>
    );
  }

  // Group links by type
  const grouped = new Map<string, typeof allLinks>();
  for (const link of allLinks) {
    const existing = grouped.get(link.type) || [];
    existing.push(link);
    grouped.set(link.type, existing);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-medium flex-1">Links</h4>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2">
        {Array.from(grouped.entries()).map(([type, items]) => (
          <div key={type}>
            <span className="text-xs text-muted-foreground font-medium uppercase">
              {LINK_TYPE_LABELS[type] || type.replace(/_/g, " ")}
            </span>
            <div className="space-y-1 mt-1">
              {items.map((link) => (
                <div key={link.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 group">
                  <span className="text-xs text-muted-foreground font-mono">
                    {(link.task as any)?.project?.taskPrefix || "DK"}-{link.task.taskNumber}
                  </span>
                  <span className={`text-sm flex-1 truncate ${link.task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                    {link.task.title}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {link.task.status.replace(/_/g, " ")}
                  </Badge>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeLinkMutation.mutate({ id: link.id })}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <LinkDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        linkType={linkType}
        setLinkType={setLinkType}
        search={search}
        setSearch={setSearch}
        searchResults={searchResults?.tasks}
        taskId={taskId}
        onAdd={(targetId) => addLinkMutation.mutate({ taskId, targetTaskId: targetId, linkType: linkType as any })}
        isPending={addLinkMutation.isPending}
      />
    </div>
  );
}

function LinkDialog({
  open, onOpenChange, linkType, setLinkType, search, setSearch, searchResults, taskId, onAdd, isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkType: string;
  setLinkType: (t: string) => void;
  search: string;
  setSearch: (s: string) => void;
  searchResults?: any[];
  taskId: string;
  onAdd: (targetId: string) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Link Task</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Link Type</span>
            <Select value={linkType} onValueChange={setLinkType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Search Task</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title..."
              autoFocus
            />
          </div>
          {searchResults && searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
              {searchResults
                .filter((t: any) => t.id !== taskId)
                .map((t: any) => (
                  <button
                    key={t.id}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors text-left"
                    onClick={() => onAdd(t.id)}
                    disabled={isPending}
                  >
                    <span className="text-xs text-muted-foreground font-mono">DK-{t.taskNumber}</span>
                    <span className="flex-1 truncate">{t.title}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
