"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { ClipboardCheck, CheckCircle2, XCircle, MessageSquare, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const statusBadge: Record<string, { class: string; label: string }> = {
  pending: { class: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Pending" },
  approved: { class: "bg-green-500/10 text-green-400 border-green-500/20", label: "Approved" },
  rejected: { class: "bg-red-500/10 text-red-400 border-red-500/20", label: "Rejected" },
  changes_requested: { class: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Changes Requested" },
};

export default function ApprovalsPage() {
  const { workspaceId } = useAuthStore();
  const [tab, setTab] = useState("pending");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const utils = trpc.useUtils();

  const { data: pendingApprovals, isLoading: loadingPending } = trpc.approval.list.useQuery(
    { workspaceId: workspaceId || "", type: "pending" },
    { enabled: !!workspaceId }
  );

  const { data: allApprovals, isLoading: loadingAll } = trpc.approval.list.useQuery(
    { workspaceId: workspaceId || "", type: "all" },
    { enabled: !!workspaceId && tab === "all" }
  );

  const respondMutation = trpc.approval.respond.useMutation({
    onSuccess: () => {
      utils.approval.list.invalidate();
      utils.approval.pendingCount.invalidate();
      setRespondingId(null);
      setComment("");
      toast.success("Response submitted");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleRespond = (id: string, status: "approved" | "rejected" | "changes_requested") => {
    respondMutation.mutate({ id, status, comment: comment || undefined });
  };

  const approvals = tab === "pending" ? pendingApprovals : allApprovals;
  const isLoading = tab === "pending" ? loadingPending : loadingAll;

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Approvals" }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-indigo-400" /> My Approvals
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Tasks awaiting your review</p>
          </div>
          {pendingApprovals && pendingApprovals.length > 0 && (
            <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
              {pendingApprovals.length} pending
            </Badge>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : !approvals?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No approvals</p>
            <p className="text-sm">{tab === "pending" ? "You're all caught up!" : "No approval history"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((approval: any) => {
              const badge = statusBadge[approval.status] || statusBadge.pending;
              return (
                <Card key={approval.id} className="border-border/50 bg-slate-900/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        {approval.requestedBy?.avatarUrl && <AvatarImage src={approval.requestedBy.avatarUrl} />}
                        <AvatarFallback className="text-xs bg-indigo-500/20 text-indigo-400">
                          {approval.requestedBy?.name?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{approval.task?.title || "Unknown task"}</span>
                          <Badge variant="outline" className={badge.class}>{badge.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Requested by {approval.requestedBy?.name || "Unknown"} · {approval.task?.project?.name || ""} · {formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true })}
                        </p>
                        {approval.comment && (
                          <p className="text-xs text-muted-foreground mt-1 bg-slate-800/50 rounded p-2">
                            <MessageSquare className="h-3 w-3 inline mr-1" />{approval.comment}
                          </p>
                        )}

                        {approval.status === "pending" && (
                          <div className="mt-3">
                            {respondingId === approval.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  placeholder="Add a comment (optional)..."
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  rows={2}
                                  className="text-xs"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                    onClick={() => handleRespond(approval.id, "approved")}
                                    disabled={respondMutation.isPending}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                                  </Button>
                                  <Button
                                    size="sm" variant="destructive" className="h-7 text-xs"
                                    onClick={() => handleRespond(approval.id, "rejected")}
                                    disabled={respondMutation.isPending}
                                  >
                                    <XCircle className="h-3 w-3 mr-1" /> Reject
                                  </Button>
                                  <Button
                                    size="sm" variant="outline" className="h-7 text-xs"
                                    onClick={() => handleRespond(approval.id, "changes_requested")}
                                    disabled={respondMutation.isPending}
                                  >
                                    Request Changes
                                  </Button>
                                  <Button
                                    size="sm" variant="ghost" className="h-7 text-xs ml-auto"
                                    onClick={() => { setRespondingId(null); setComment(""); }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button
                                  size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700"
                                  onClick={() => handleRespond(approval.id, "approved")}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                                </Button>
                                <Button
                                  size="sm" variant="destructive" className="h-7 text-xs"
                                  onClick={() => handleRespond(approval.id, "rejected")}
                                >
                                  <XCircle className="h-3 w-3 mr-1" /> Reject
                                </Button>
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => setRespondingId(approval.id)}
                                >
                                  <MessageSquare className="h-3 w-3 mr-1" /> Comment
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
