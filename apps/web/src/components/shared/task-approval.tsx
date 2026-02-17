"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, Clock, MessageSquare } from "lucide-react";

export function TaskApproval({ taskId, projectId, workspaceId }: { taskId: string; projectId: string; workspaceId: string }) {
  const [showRequest, setShowRequest] = useState(false);
  const [approverId, setApproverId] = useState("");
  const [respondComment, setRespondComment] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const { data: approvals, refetch } = trpc.approval.taskApprovals.useQuery({ taskId });
  const { data: members } = trpc.workspace.getMembers.useQuery({ workspaceId }, { enabled: showRequest && !!workspaceId });

  const requestMutation = trpc.approval.request.useMutation({
    onSuccess: () => { toast.success("Approval requested"); setShowRequest(false); setApproverId(""); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const respondMutation = trpc.approval.respond.useMutation({
    onSuccess: () => { toast.success("Response submitted"); setRespondingId(null); setRespondComment(""); refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
      case "rejected": return <XCircle className="h-3.5 w-3.5 text-red-400" />;
      case "changes_requested": return <MessageSquare className="h-3.5 w-3.5 text-amber-400" />;
      default: return <Clock className="h-3.5 w-3.5 text-yellow-400" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-500/10 text-green-400 border-green-500/20";
      case "rejected": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "changes_requested": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Approvals
        </h4>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-violet-400 hover:text-violet-300" onClick={() => setShowRequest(!showRequest)}>
          + Request
        </Button>
      </div>

      {showRequest && (
        <div className="p-3 rounded-lg border border-border bg-muted/30 mb-3 space-y-2">
          <Select value={approverId} onValueChange={setApproverId}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select approver..." />
            </SelectTrigger>
            <SelectContent>
              {members?.map((m: any) => (
                <SelectItem key={m.user.id} value={m.user.id}>{m.user.name || m.user.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-500" disabled={!approverId || requestMutation.isPending}
              onClick={() => requestMutation.mutate({ taskId, approverId })}>
              {requestMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Send Request
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowRequest(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {approvals && approvals.length > 0 && (
        <div className="space-y-2">
          {approvals.map((a: any) => (
            <div key={a.id} className="p-2.5 rounded-lg border border-border bg-muted/20 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusIcon(a.status)}
                  <span className="text-muted-foreground">{a.approver?.name || "Unknown"}</span>
                  <Badge variant="outline" className={`text-[10px] ${statusColor(a.status)}`}>
                    {a.status.replace("_", " ")}
                  </Badge>
                </div>
                {a.status === "pending" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-green-400 hover:bg-green-500/10"
                      onClick={() => respondMutation.mutate({ approvalId: a.id, status: "approved", comment: "" })}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400 hover:bg-red-500/10"
                      onClick={() => setRespondingId(a.id)}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
              {a.comment && <p className="text-xs text-muted-foreground mt-1 pl-5">{a.comment}</p>}
              {respondingId === a.id && (
                <div className="mt-2 space-y-2">
                  <Textarea placeholder="Add a comment..." value={respondComment} onChange={(e) => setRespondComment(e.target.value)} className="text-xs min-h-[60px]" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-6 text-xs bg-red-600 hover:bg-red-500"
                      onClick={() => respondMutation.mutate({ approvalId: a.id, status: "rejected", comment: respondComment })}>
                      Reject
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-xs"
                      onClick={() => respondMutation.mutate({ approvalId: a.id, status: "changes_requested", comment: respondComment })}>
                      Request Changes
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setRespondingId(null); setRespondComment(""); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
