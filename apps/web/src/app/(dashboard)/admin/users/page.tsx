"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopBar } from "@/components/layout/topbar";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default function AdminUsers() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  if (user?.email !== "llokesh65@gmail.com") {
    router.push("/home");
    return null;
  }

  const { data, isLoading } = trpc.admin.listUsers.useQuery({ page, limit: 20, search: search || undefined });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Users" }]} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Users</h1>
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
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Workspaces</th>
                  <th className="p-3 font-medium">Created</th>
                  <th className="p-3 font-medium">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800/50 text-slate-300 hover:bg-slate-800/50">
                    <td className="p-3 text-white">{u.name}</td>
                    <td className="p-3 text-slate-400">{u.email}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {u.workspaceMembers.map((wm) => (
                          <Badge key={wm.workspace.id} variant="outline" className="text-xs cursor-pointer" onClick={() => router.push(`/admin/workspaces/${wm.workspace.id}`)}>
                            {wm.workspace.name}
                          </Badge>
                        ))}
                        {u.workspaceMembers.length === 0 && <span className="text-slate-500">None</span>}
                      </div>
                    </td>
                    <td className="p-3 text-slate-400">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                    <td className="p-3 text-slate-400">{u.lastLoginAt ? format(new Date(u.lastLoginAt), "MMM d, HH:mm") : "Never"}</td>
                  </tr>
                ))}
                {isLoading && (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-500">Loading...</td></tr>
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
