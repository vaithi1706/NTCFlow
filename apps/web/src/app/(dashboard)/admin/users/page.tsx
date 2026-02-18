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
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name or email..."
              className="pl-9 bg-muted border-border text-foreground"
            />
          </div>
        </div>

        <Card className="bg-muted border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Email</th>
                  <th className="p-3 font-medium">Workspaces</th>
                  <th className="p-3 font-medium">Created</th>
                  <th className="p-3 font-medium">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 text-muted-foreground hover:bg-muted/60">
                    <td className="p-3 text-foreground">{u.name}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {u.workspaceMembers.map((wm) => (
                          <Badge key={wm.workspace.id} variant="outline" className="text-xs cursor-pointer" onClick={() => router.push(`/admin/workspaces/${wm.workspace.id}`)}>
                            {wm.workspace.name}
                          </Badge>
                        ))}
                        {u.workspaceMembers.length === 0 && <span className="text-muted-foreground">None</span>}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                    <td className="p-3 text-muted-foreground">{u.lastLoginAt ? format(new Date(u.lastLoginAt), "MMM d, HH:mm") : "Never"}</td>
                  </tr>
                ))}
                {isLoading && (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page} of {data.pages} ({data.total} total)</span>
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
