"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileIcon } from "./file-icon";
import {
  Download,
  FileUp,
  Trash2,
  RotateCcw,
  Tag,
  Link2,
  Pencil,
  Check,
  X,
  GitBranch,
  Plus,
  Search,
  Layers,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import { CategoryPicker } from "./category-picker";

interface DocumentDetailSheetProps {
  document: any;
  projectId: string;
  onClose: () => void;
  onUploadVersion: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onRollback: (versionId: string) => void;
  onUpdate: (data: { title?: string; description?: string | null }) => void;
  onRefresh: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TAG_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export function DocumentDetailSheet({
  document: doc,
  projectId,
  onClose,
  onUploadVersion,
  onDelete,
  onRestore,
  onRollback,
  onUpdate,
  onRefresh,
}: DocumentDetailSheetProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [taskPopoverOpen, setTaskPopoverOpen] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");

  const utils = trpc.useUtils();

  // Queries
  const { data: allTags } = trpc.document.tag.list.useQuery(
    { projectId },
    { enabled: !!projectId && tagPopoverOpen }
  );

  const { data: taskResults } = trpc.task.list.useQuery(
    { projectId, search: taskSearch || undefined, limit: 10 },
    { enabled: !!projectId && taskPopoverOpen && taskSearch.length > 0 }
  );

  // Tag mutations
  const assignTag = trpc.document.tag.assign.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Tag added"); },
  });
  const unassignTag = trpc.document.tag.unassign.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Tag removed"); },
  });
  const createTag = trpc.document.tag.create.useMutation({
    onSuccess: (newTag) => {
      assignTag.mutate({ documentId: doc.id, tagId: newTag.id });
      setNewTagName("");
      setShowNewTagForm(false);
      utils.document.tag.list.invalidate({ projectId });
    },
  });

  // Task link mutations
  const linkTask = trpc.document.taskLink.link.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Task linked"); setTaskSearch(""); },
  });
  const unlinkTask = trpc.document.taskLink.unlink.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Task unlinked"); },
  });

  if (!doc) return null;

  const isDeleted = !!doc.deletedAt;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const assignedTagIds = new Set(doc.tags?.map((t: any) => t.tag.id) || []);
  const linkedTaskIds = new Set(doc.taskLinks?.map((l: any) => l.task.id) || []);
  const availableTags = (allTags || []).filter((t: any) => !assignedTagIds.has(t.id));
  const availableTasks = (taskResults?.tasks || []).filter((t: any) => !linkedTaskIds.has(t.id));

  return (
    <Sheet open={!!doc} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-muted/60 flex-shrink-0">
                <FileIcon fileType={doc.fileType} size="lg" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                {editingTitle ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="h-8 text-sm font-medium"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { onUpdate({ title: titleDraft }); setEditingTitle(false); }
                        if (e.key === "Escape") setEditingTitle(false);
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                      onClick={() => { onUpdate({ title: titleDraft }); setEditingTitle(false); }}>
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                      onClick={() => setEditingTitle(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <SheetTitle
                    className="text-base font-semibold leading-tight cursor-pointer hover:text-primary transition-colors group flex items-center gap-1.5"
                    onClick={() => { setTitleDraft(doc.title); setEditingTitle(true); }}>
                    <span className="truncate">{doc.title}</span>
                    <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 flex-shrink-0" />
                  </SheetTitle>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {doc.createdBy?.name} &middot; {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4">
              {!isDeleted && (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onUploadVersion}>
                    <FileUp className="h-3.5 w-3.5 mr-1.5" />
                    New Version
                  </Button>
                  {doc.currentVersion && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                      <a href={`${apiUrl}${doc.currentVersion.fileUrl}`} download={doc.currentVersion.fileName} target="_blank" rel="noopener">
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download
                      </a>
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={onDelete}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {isDeleted && (
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onRestore}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Restore
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="px-5 py-4 space-y-5">
          {/* Description */}
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Description
            </h4>
            {editingDesc ? (
              <div className="space-y-2">
                <Textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={3} className="text-sm" autoFocus />
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 text-xs" onClick={() => { onUpdate({ description: descDraft || null }); setEditingDesc(false); }}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingDesc(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className={cn("text-sm cursor-pointer rounded-md px-3 py-2 -mx-1 transition-colors",
                  doc.description ? "text-foreground hover:bg-accent" : "text-muted-foreground italic hover:bg-accent")}
                onClick={() => { setDescDraft(doc.description || ""); setEditingDesc(true); }}>
                {doc.description || "Add a description..."}
              </p>
            )}
          </section>

          <div className="border-t border-border" />

          {/* ─── Category ─── */}
          {!isDeleted && (
            <section>
              <CategoryPicker
                projectId={projectId}
                currentCategory={doc.category || null}
                onSelect={(categoryId) => {
                  onUpdate({ categoryId } as any);
                }}
              />
            </section>
          )}
          {isDeleted && doc.category && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Category</h4>
              </div>
              <Badge variant="outline" className="text-xs border-0 h-6" style={{ backgroundColor: `${doc.category.color}15`, color: doc.category.color }}>
                {doc.category.parent && `${doc.category.parent.name} / `}{doc.category.name}
              </Badge>
            </section>
          )}

          <div className="border-t border-border" />

          {/* ─── Tags ─── */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
                Tags
              </h4>
              {!isDeleted && (
                <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end">
                    {!showNewTagForm ? (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground px-2 py-1">Add a tag</p>
                        {availableTags.length > 0 ? (
                          availableTags.map((tag: any) => (
                            <button
                              key={tag.id}
                              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left"
                              onClick={() => {
                                assignTag.mutate({ documentId: doc.id, tagId: tag.id });
                                setTagPopoverOpen(false);
                              }}
                            >
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </button>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground px-2 py-1">No more tags available</p>
                        )}
                        <div className="border-t border-border my-1" />
                        <button
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left text-primary"
                          onClick={() => setShowNewTagForm(true)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create new tag
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground px-1">New tag</p>
                        <Input
                          placeholder="Tag name"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTagName.trim()) {
                              createTag.mutate({ projectId, name: newTagName.trim(), color: newTagColor });
                            }
                          }}
                        />
                        <div className="flex items-center gap-1 px-1">
                          {TAG_COLORS.map((c) => (
                            <button
                              key={c}
                              className={cn("w-5 h-5 rounded-full transition-all", newTagColor === c ? "ring-2 ring-offset-1 ring-offset-background ring-primary scale-110" : "hover:scale-110")}
                              style={{ backgroundColor: c }}
                              onClick={() => setNewTagColor(c)}
                            />
                          ))}
                        </div>
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7 text-xs flex-1" disabled={!newTagName.trim()}
                            onClick={() => createTag.mutate({ projectId, name: newTagName.trim(), color: newTagColor })}>
                            Create
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => { setShowNewTagForm(false); setNewTagName(""); }}>
                            Back
                          </Button>
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {doc.tags?.length > 0 ? (
                doc.tags.map((t: any) => (
                  <Badge
                    key={t.tag.id}
                    variant="outline"
                    className="text-xs border-0 h-6 gap-1 pr-1 group/tag cursor-default"
                    style={{ backgroundColor: `${t.tag.color}15`, color: t.tag.color }}
                  >
                    {t.tag.name}
                    {!isDeleted && (
                      <button
                        className="ml-0.5 rounded-full p-0.5 opacity-0 group-hover/tag:opacity-100 hover:bg-black/10 transition-opacity"
                        onClick={() => unassignTag.mutate({ documentId: doc.id, tagId: t.tag.id })}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">No tags</span>
              )}
            </div>
          </section>

          <div className="border-t border-border" />

          {/* ─── Linked Tasks ─── */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
                Linked Tasks
              </h4>
              {!isDeleted && (
                <Popover open={taskPopoverOpen} onOpenChange={(v) => { setTaskPopoverOpen(v); if (!v) setTaskSearch(""); }}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="end">
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search tasks..."
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          className="h-8 text-sm pl-8"
                          autoFocus
                        />
                      </div>
                      {taskSearch.length > 0 && (
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {availableTasks.length > 0 ? (
                            availableTasks.map((task: any) => (
                              <button
                                key={task.id}
                                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left"
                                onClick={() => {
                                  linkTask.mutate({ documentId: doc.id, taskId: task.id });
                                  setTaskPopoverOpen(false);
                                }}
                              >
                                <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                                  #{task.taskNumber}
                                </span>
                                <span className="truncate">{task.title}</span>
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground px-2 py-2 text-center">No tasks found</p>
                          )}
                        </div>
                      )}
                      {taskSearch.length === 0 && (
                        <p className="text-xs text-muted-foreground px-2 py-1">Type to search tasks...</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="space-y-1.5">
              {doc.taskLinks?.length > 0 ? (
                doc.taskLinks.map((link: any) => (
                  <div
                    key={link.task.id}
                    className="group/task flex items-center gap-2.5 py-1.5 px-3 rounded-md bg-muted/30 text-sm"
                  >
                    <span className="text-[11px] font-mono text-muted-foreground font-medium">
                      #{link.task.taskNumber}
                    </span>
                    <span className="truncate flex-1 text-sm">{link.task.title}</span>
                    <Badge variant="outline" className="text-[10px] h-5 flex-shrink-0">
                      {link.task.status?.replace(/_/g, " ")}
                    </Badge>
                    {!isDeleted && (
                      <button
                        className="opacity-0 group-hover/task:opacity-100 p-0.5 rounded hover:bg-accent transition-all"
                        onClick={() => unlinkTask.mutate({ documentId: doc.id, taskId: link.task.id })}
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">No linked tasks</span>
              )}
            </div>
          </section>

          <div className="border-t border-border" />

          {/* ─── Version History ─── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Version History
              </h4>
              <span className="text-[11px] text-muted-foreground/60">
                ({doc.versions?.length || 0})
              </span>
            </div>

            <div className="relative pl-5">
              {doc.versions?.length > 1 && (
                <div className="absolute left-[10px] top-3 bottom-3 w-px bg-border" />
              )}

              <div className="space-y-4">
                {doc.versions?.map((v: any) => {
                  const isCurrent = v.id === doc.currentVersionId;
                  return (
                    <div key={v.id} className="flex gap-3.5 relative">
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 -ml-5",
                          isCurrent ? "border-primary bg-primary/20" : "border-border bg-background")}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", isCurrent ? "bg-primary" : "bg-muted-foreground/30")} />
                      </div>

                      <div className="flex-1 min-w-0 -mt-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">v{v.versionNumber}</span>
                          {isCurrent && (
                            <Badge className="text-[10px] h-4 px-1.5 bg-primary/15 text-primary border-0 font-medium">
                              Current
                            </Badge>
                          )}
                        </div>
                        {v.versionNote && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{v.versionNote}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[8px] bg-muted">{v.uploadedBy?.name?.charAt(0) || "?"}</AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground">{v.uploadedBy?.name}</span>
                          <span className="text-[11px] text-muted-foreground/50">&middot;</span>
                          <span className="text-[11px] text-muted-foreground">{format(new Date(v.createdAt), "MMM d, yyyy h:mm a")}</span>
                          <span className="text-[11px] text-muted-foreground/50">&middot;</span>
                          <span className="text-[11px] text-muted-foreground">{formatSize(v.fileSize)}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground" asChild>
                            <a href={`${apiUrl}${v.fileUrl}`} download={v.fileName} target="_blank" rel="noopener">
                              <Download className="h-3 w-3 mr-1" /> Download
                            </a>
                          </Button>
                          {!isCurrent && !isDeleted && (
                            <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => onRollback(v.id)}>
                              <RotateCcw className="h-3 w-3 mr-1" /> Rollback
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
