"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopBar } from "@/components/layout/topbar";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminWorkspaces() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const utils = trpc.useUtils();

  if (user?.email !== "llokesh65@gmail.com") {
    router.push("/home");
    return null;
  }

  const { data, isLoading } = trpc.admin.listWorkspaces.useQuery({ page, limit: 20, search: search || undefined });
  const revoke = trpc.admin.revokeSubscription.useMutation({
    onSuccess: () => {
      toast.success("Subscription revoked");
      utils.admin.listWorkspaces.invalidate();
    },
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Workspaces" }]} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Workspaces</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name or email..."
              className="pl-9 bg-slate-800 border-slate-700 text-white"
            />
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-left">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Owner</th>
                  <th className="p-3 font-medium">Members</th>
                  <th className="p-3 font-medium">Projects</th>
                  <th className="p-3 font-medium">Tasks</th>
                  <th className="p-3 font-medium">Plan</th>
                  <th className="p-3 font-medium">Created</th>
                  <th className="p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.workspaces.map((w) => (
                  <tr key={w.id} className="border-b border-slate-800/50 text-slate-300 hover:bg-slate-800/50 cursor-pointer" onClick={() => router.push(`/admin/workspaces/${w.id}`)}>
                    <td className="p-3">
                      <div className="font-medium text-white">{w.name}</div>
                      <div className="text-xs text-slate-500">{w.slug}</div>
                    </td>
                    <td className="p-3">
                      <div>{w.owner.name}</div>
                      <div className="text-xs text-slate-500">{w.owner.email}</div>
                    </td>
                    <td className="p-3">{w._count.members}</td>
                    <td className="p-3">{w._count.projects}</td>
                    <td className="p-3">{w.taskCount}</td>
                    <td className="p-3">
                      <Badge variant={w.subscription?.plan === "pro" ? "default" : "secondary"} className={w.subscription?.plan === "pro" ? "bg-yellow-600 text-white" : ""}>
                        {w.subscription?.plan || "free"}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-400">{format(new Date(w.createdAt), "MMM d, yyyy")}</td>
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      {w.subscription?.plan === "pro" && (
                        <Button size="sm" variant="destructive" onClick={() => revoke.mutate({ workspaceId: w.id })} disabled={revoke.isPending}>
                          Revoke Pro
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {isLoading && (
                  <tr><td colSpan={8} className="p-4 text-center text-slate-500">Loading...</td></tr>
                )}
                {data?.workspaces.length === 0 && (
                  <tr><td colSpan={8} className="p-4 text-center text-slate-500">No workspaces found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-slate-800">
              <span className="text-xs text-slate-400">Page {page} of {data.pages} ({data.total} total)</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setPage(page - 1)} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => setPage(page + 1)} disabled={page >= data.pages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
