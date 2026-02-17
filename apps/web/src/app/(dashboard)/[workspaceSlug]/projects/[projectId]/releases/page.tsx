"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Plus, Package, Rocket, Archive, Calendar, Loader2, Trash2, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AiReleaseNotesDialog } from "@/components/ai/ai-release-notes-dialog";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  unreleased: { label: "Unreleased", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Package },
  released: { label: "Released", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: Rocket },
  archived: { label: "Archived", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: Archive },
};

export default function ReleasesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;

  const { workspaceId } = useAuthStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [releaseConfirmId, setReleaseConfirmId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currentView, setCurrentView] = useState("releases");

  const utils = trpc.useUtils();

  const { data: project } = trpc.project.getById.useQuery({ id: projectId });
  const { data: versions, isLoading } = trpc.version.list.useQuery({ projectId });
  const { data: versionDetail } = trpc.version.getById.useQuery(
    { id: detailId! },
    { enabled: !!detailId }
  );

  const createMutation = trpc.version.create.useMutation({
    onSuccess: () => {
      setCreateOpen(false);
      setName("");
      setDescription("");
      utils.version.list.invalidate({ projectId });
      toast.success("Version created");
    },
    onError: (e) => toast.error(e.message),
  });

  const releaseMutation = trpc.version.release.useMutation({
    onSuccess: () => {
      setReleaseConfirmId(null);
      utils.version.list.invalidate({ projectId });
      toast.success("Version released! 🚀");
    },
  });

  const deleteMutation = trpc.version.delete.useMutation({
    onSuccess: () => {
      utils.version.list.invalidate({ projectId });
      toast.success("Version deleted");
    },
  });

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  const breadcrumbs = [
    { label: "DKFlow", href: "/home" },
    { label: project?.name || "Project" },
    { label: "Releases" },
  ];

  return (
    <>
      <TopBar
        breadcrumbs={breadcrumbs}
        showViewSwitcher
        currentView={currentView}
        onViewChange={handleViewChange}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Releases</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track versions and releases for this project
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />New Version
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !versions?.length ? (
          <div className="text-center py-20">
            <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-medium">No versions yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first version to start tracking releases</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Create Version
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((v: any) => {
              const sc = statusConfig[v.status] || statusConfig.unreleased;
              const Icon = sc.icon;
              return (
                <Card
                  key={v.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setDetailId(v.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{v.name}</h3>
                          <Badge variant="outline" className={sc.color}>
                            <Icon className="h-3 w-3 mr-1" />{sc.label}
                          </Badge>
                        </div>
                        {v.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{v.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {v.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(v.startDate), "MMM d, yyyy")}
                            </span>
                          )}
                          {v.releaseDate && (
                            <span>→ {format(new Date(v.releaseDate), "MMM d, yyyy")}</span>
                          )}
                          {v.releasedAt && (
                            <span className="text-green-400">
                              Released {format(new Date(v.releasedAt), "MMM d, yyyy")}
                            </span>
                          )}
                          <span>{v.taskCount} task{v.taskCount !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Progress */}
                        <div className="w-32">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{v.doneCount}/{v.taskCount}</span>
                            <span className="font-medium">{v.progress}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${v.progress}%` }}
                            />
                          </div>
                        </div>
                        {v.status === "unreleased" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); setReleaseConfirmId(v.id); }}
                          >
                            <Rocket className="h-3 w-3 mr-1" />Release
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ id: v.id }); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="v1.0.0" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Release notes..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({ projectId, name, description: description || undefined })}
              disabled={!name.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Confirm */}
      <AlertDialog open={!!releaseConfirmId} onOpenChange={() => setReleaseConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release this version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the version as released with today&apos;s date. This action can be undone by changing the status back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => releaseConfirmId && releaseMutation.mutate({ id: releaseConfirmId })}>
              Release 🚀
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Version Detail Sheet */}
      <Sheet open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {versionDetail && (
            <div className="space-y-4 pt-4">
              <div>
                <h2 className="text-xl font-bold">{versionDetail.name}</h2>
                {versionDetail.description && (
                  <p className="text-sm text-muted-foreground mt-1">{versionDetail.description}</p>
                )}
                <Badge variant="outline" className={`mt-2 ${statusConfig[versionDetail.status]?.color}`}>
                  {statusConfig[versionDetail.status]?.label}
                </Badge>
                <div className="mt-3">
                  {workspaceId && (
                    <AiReleaseNotesDialog versionId={versionDetail.id} workspaceId={workspaceId} />
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3">Tasks ({versionDetail.tasks.length})</h3>
                {versionDetail.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks linked to this version</p>
                ) : (
                  <div className="space-y-2">
                    {versionDetail.tasks.map((tv: any) => (
                      <div key={tv.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20">
                        <Badge variant="outline" className="text-[10px]">{tv.type}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          DK-{tv.task.taskNumber}
                        </span>
                        <span className="text-sm flex-1 truncate">{tv.task.title}</span>
                        {tv.task.column && (
                          <Badge variant="secondary" className="text-[10px]">
                            <span className="h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: tv.task.column.color || "#94A3B8" }} />
                            {tv.task.column.name}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
