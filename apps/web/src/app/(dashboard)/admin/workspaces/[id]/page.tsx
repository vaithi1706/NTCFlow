"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/topbar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { format } from "date-fns";

export default function WorkspaceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const router = useRouter();
  const utils = trpc.useUtils();

  if (user?.email !== "llokesh65@gmail.com") {
    router.push("/home");
    return null;
  }

  const { data: ws, isLoading } = trpc.admin.getWorkspaceDetail.useQuery({ workspaceId: id });
  const revoke = trpc.admin.revokeSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription revoked");
      utils.admin.getWorkspaceDetail.invalidate();
    },
  });

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-slate-500">Loading...</div>;
  if (!ws) return <div className="flex-1 flex items-center justify-center text-slate-500">Not found</div>;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Workspaces", href: "/admin/workspaces" }, { label: ws.name }]} />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800 p-4 lg:col-span-2">
            <h2 className="text-lg font-bold text-white mb-2">{ws.name}</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-400">Slug:</span> <span className="text-slate-200">{ws.slug}</span></div>
              <div><span className="text-slate-400">Owner:</span> <span className="text-slate-200">{ws.owner.name} ({ws.owner.email})</span></div>
              <div><span className="text-slate-400">Created:</span> <span className="text-slate-200">{format(new Date(ws.createdAt), "MMM d, yyyy")}</span></div>
              <div><span className="text-slate-400">Members:</span> <span className="text-slate-200">{ws.members.length}</span></div>
            </div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">Subscription</h3>
            <div className="space-y-2">
              <Badge variant={ws.subscription?.plan === "pro" ? "default" : "secondary"} className={ws.subscription?.plan === "pro" ? "bg-yellow-600 text-white" : ""}>
                {ws.subscription?.plan || "free"}
              </Badge>
              <div className="text-xs text-slate-400">Status: {ws.subscription?.status || "active"}</div>
              {ws.subscription?.plan === "pro" && (
                <Button size="sm" variant="destructive" onClick={() => revoke.mutate({ workspaceId: ws.id })} disabled={revoke.isPending}>
                  Revoke Pro
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Members */}
        <Card className="bg-slate-900 border-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Members ({ws.members.length})</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="pb-2 font-medium">User</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {ws.members.map((m) => (
                <tr key={m.id} className="border-b border-slate-800/50 text-slate-300">
                  <td className="py-2 flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs bg-slate-700">{m.user.name?.[0]}</AvatarFallback>
                    </Avatar>
                    {m.user.name}
                  </td>
                  <td className="py-2 text-slate-400">{m.user.email}</td>
                  <td className="py-2"><Badge variant="outline" className="text-xs">{m.role}</Badge></td>
                  <td className="py-2 text-slate-400">{format(new Date(m.joinedAt), "MMM d, yyyy")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Projects */}
        <Card className="bg-slate-900 border-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Projects ({ws.projects.length})</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-left">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Identifier</th>
                <th className="pb-2 font-medium">Tasks</th>
                <th className="pb-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {ws.projects.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 text-slate-300">
                  <td className="py-2 text-white">{p.name}</td>
                  <td className="py-2 text-slate-400">{p.identifier}</td>
                  <td className="py-2">{p._count.tasks}</td>
                  <td className="py-2 text-slate-400">{format(new Date(p.createdAt), "MMM d, yyyy")}</td>
                </tr>
              ))}
              {ws.projects.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">No projects</td></tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Activity */}
        <Card className="bg-slate-900 border-slate-800 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Recent Activity</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {ws.recentActivity.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 text-sm text-slate-400">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px] bg-slate-700">{a.user?.name?.[0]}</AvatarFallback>
                </Avatar>
                <span className="text-slate-300">{a.user?.name}</span>
                <span>{a.action}</span>
                <span className="ml-auto text-xs">{format(new Date(a.createdAt), "MMM d, HH:mm")}</span>
              </div>
            ))}
            {ws.recentActivity.length === 0 && (
              <div className="text-sm text-slate-500">No recent activity</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
