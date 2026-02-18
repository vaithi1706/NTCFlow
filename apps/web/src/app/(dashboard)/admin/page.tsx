"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopBar } from "@/components/layout/topbar";
import { Users, Building2, Crown, KeyRound, TrendingUp, Calendar, Plus, Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [genOpen, setGenOpen] = useState(false);
  const [durationDays, setDurationDays] = useState(365);
  const [maxUses, setMaxUses] = useState(1);
  const [note, setNote] = useState("");

  if (user?.email !== "llokesh65@gmail.com") {
    router.push("/home");
    return null;
  }

  const { data, isLoading } = trpc.admin.dashboard.useQuery();
  const generateKey = trpc.admin.generateLicenseKey.useMutation({
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.key);
      toast.success(`Key generated & copied: ${data.key}`);
      setGenOpen(false);
    },
  });

  const stats = [
    { label: "Total Users", value: data?.totalUsers ?? "—", icon: Users, color: "text-blue-400" },
    { label: "Workspaces", value: data?.totalWorkspaces ?? "—", icon: Building2, color: "text-indigo-400" },
    { label: "Pro Subscriptions", value: data?.proSubscriptions ?? "—", icon: Crown, color: "text-yellow-400" },
    { label: "License Keys", value: data?.totalLicenseKeys ?? "—", icon: KeyRound, color: "text-green-400" },
    { label: "Signups This Week", value: data?.signupsThisWeek ?? "—", icon: TrendingUp, color: "text-cyan-400" },
    { label: "Signups This Month", value: data?.signupsThisMonth ?? "—", icon: Calendar, color: "text-purple-400" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar breadcrumbs={[{ label: "Admin", href: "/admin" }]} />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Generate Key
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="bg-muted border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Link href="/admin/workspaces" className="block">
            <Card className="bg-muted border-border p-4 hover:border-blue-600 transition-colors cursor-pointer">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Workspaces</h3>
              <p className="text-xs text-muted-foreground">Manage all workspaces & subscriptions</p>
            </Card>
          </Link>
          <Link href="/admin/users" className="block">
            <Card className="bg-muted border-border p-4 hover:border-blue-600 transition-colors cursor-pointer">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">Users</h3>
              <p className="text-xs text-muted-foreground">View all registered users</p>
            </Card>
          </Link>
          <Link href="/admin/licenses" className="block">
            <Card className="bg-muted border-border p-4 hover:border-blue-600 transition-colors cursor-pointer">
              <h3 className="text-sm font-medium text-muted-foreground mb-1">License Keys</h3>
              <p className="text-xs text-muted-foreground">Generate & manage license keys</p>
            </Card>
          </Link>
        </div>

        {/* Recent Signups */}
        <Card className="bg-muted border-border p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent Signups</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Joined</th>
                  <th className="pb-2 font-medium">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {data?.recentSignups.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 text-muted-foreground">
                    <td className="py-2">{u.name}</td>
                    <td className="py-2 text-muted-foreground">{u.email}</td>
                    <td className="py-2 text-muted-foreground">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                    <td className="py-2 text-muted-foreground">{u.lastLoginAt ? format(new Date(u.lastLoginAt), "MMM d, HH:mm") : "Never"}</td>
                  </tr>
                ))}
                {isLoading && (
                  <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Loading...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Generate Key Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto bg-muted border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Generate License Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Duration (days)</Label>
              <Input type="number" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <Label className="text-muted-foreground">Max Uses</Label>
              <Input type="number" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <Label className="text-muted-foreground">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="bg-muted border-border text-foreground" placeholder="e.g. For customer X" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button onClick={() => generateKey.mutate({ durationDays, maxUses, note: note || undefined })} disabled={generateKey.isPending}>
              {generateKey.isPending ? "Generating..." : "Generate & Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
