"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TopBar } from "@/components/layout/topbar";
import { Plus, Copy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminLicenses() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "active" | "used" | "expired">("all");
  const [genOpen, setGenOpen] = useState(false);
  const [durationDays, setDurationDays] = useState(365);
  const [maxUses, setMaxUses] = useState(1);
  const [note, setNote] = useState("");
  const utils = trpc.useUtils();

  if (user?.email !== "llokesh65@gmail.com") {
    router.push("/home");
    return null;
  }

  const { data: keys, isLoading } = trpc.admin.listLicenseKeys.useQuery({ filter });
  const generateKey = trpc.admin.generateLicenseKey.useMutation({
    onSuccess: (data) => {
      navigator.clipboard.writeText(data.key);
      toast.success(`Key generated & copied: ${data.key}`);
      setGenOpen(false);
      setNote("");
      utils.admin.listLicenseKeys.invalidate();
    },
  });
  const revokeKey = trpc.admin.revokeLicenseKey.useMutation({
    onSuccess: () => {
      toast.success("Key revoked");
      utils.admin.listLicenseKeys.invalidate();
    },
  });

  function getStatus(k: any) {
    if (!k.isActive) return { label: "Revoked", color: "bg-red-600" };
    if (k.expiresAt && new Date(k.expiresAt) < new Date()) return { label: "Expired", color: "bg-orange-600" };
    if (k.usedCount >= k.maxUses) return { label: "Used", color: "bg-blue-600" };
    return { label: "Active", color: "bg-green-600" };
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "License Keys" }]} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">License Keys</h1>
          <Button size="sm" onClick={() => setGenOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Generate Key
          </Button>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="bg-muted">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="used">Used</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="bg-muted border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="p-3 font-medium">Key</th>
                  <th className="p-3 font-medium">Plan</th>
                  <th className="p-3 font-medium">Duration</th>
                  <th className="p-3 font-medium">Uses</th>
                  <th className="p-3 font-medium">Used By</th>
                  <th className="p-3 font-medium">Workspace</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Created</th>
                  <th className="p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys?.map((k) => {
                  const status = getStatus(k);
                  return (
                    <tr key={k.id} className="border-b border-border/50 text-muted-foreground">
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{k.key}</code>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(k.key); toast.success("Copied"); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        {k.note && <div className="text-xs text-muted-foreground mt-0.5">{k.note}</div>}
                      </td>
                      <td className="p-3"><Badge variant="outline" className="text-xs">{k.plan}</Badge></td>
                      <td className="p-3">{k.durationDays}d</td>
                      <td className="p-3">{k.usedCount}/{k.maxUses}</td>
                      <td className="p-3 text-muted-foreground">{k.usedByUser?.email || "—"}</td>
                      <td className="p-3 text-muted-foreground">{k.workspace?.name || "—"}</td>
                      <td className="p-3"><Badge className={`${status.color} text-foreground text-xs`}>{status.label}</Badge></td>
                      <td className="p-3 text-muted-foreground">{format(new Date(k.createdAt), "MMM d, yyyy")}</td>
                      <td className="p-3">
                        {k.isActive && (
                          <Button size="sm" variant="destructive" onClick={() => revokeKey.mutate({ id: k.id })} disabled={revokeKey.isPending}>
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {isLoading && (
                  <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Loading...</td></tr>
                )}
                {keys?.length === 0 && (
                  <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">No license keys found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

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
