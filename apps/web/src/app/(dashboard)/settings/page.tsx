"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Loader2, Shield, ShieldCheck, Copy, Download, Camera } from "lucide-react";
import { AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { resetOnboardingTour, startOnboardingTour } from "@/components/shared/onboarding-tour";
import { HelpCircle } from "lucide-react";

const notificationItems = [
  { id: "task_assigned", label: "Task assigned to you" },
  { id: "task_mentioned", label: "Mentioned in a comment" },
  { id: "task_due_soon", label: "Task due soon" },
  { id: "task_overdue", label: "Task overdue" },
  { id: "task_commented", label: "New comment on your task" },
  { id: "task_status_changed", label: "Task status changed" },
];

const emailNotificationItems = [
  { id: "email_assignments", label: "Task assigned to me" },
  { id: "email_mentions", label: "Mentioned in a comment" },
  { id: "email_due_dates", label: "Task due tomorrow" },
  { id: "email_sprint_updates", label: "Sprint started / ended" },
  { id: "email_weekly_digest", label: "Weekly digest" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [uploading, setUploading] = useState(false);

  const { data: notifPrefs } = trpc.notification.getPreferences.useQuery();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (notifPrefs && typeof notifPrefs === "object") {
      setPrefs(notifPrefs as Record<string, boolean>);
    }
  }, [notifPrefs]);

  const updateMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: (data) => {
      setUser({ id: data.id, name: data.name, email: data.email, avatarUrl: data.avatarUrl });
      toast.success("Profile updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePrefsMutation = trpc.notification.updatePreferences.useMutation({
    onSuccess: () => toast.success("Notification preferences saved"),
    onError: (err) => toast.error(err.message),
  });

  const handleTogglePref = (id: string, checked: boolean) => {
    const updated = { ...prefs, [id]: checked };
    setPrefs(updated);
    updatePrefsMutation.mutate({ preferences: updated });
  };

  const themes = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];

  const initials = name ? name.split(" ").map((n) => n[0]).join("").toUpperCase() : "U";

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Settings" }]} />
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-16 w-16">
                  {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || ""} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">{initials}</AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      try {
                        const token = localStorage.getItem("dkflow-token");
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/upload`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` },
                          body: fd,
                        });
                        const data = await res.json();
                        if (data.fileUrl) {
                          const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                          const avatarUrl = data.fileUrl.startsWith("http") ? data.fileUrl : `${apiBase}${data.fileUrl}`;
                          updateMutation.mutate({ avatarUrl });
                        }
                      } catch { toast.error("Upload failed"); }
                      setUploading(false);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium">Profile Photo</p>
                <p className="text-xs text-muted-foreground">Click the avatar to upload</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} disabled type="email" />
              </div>
            </div>
            <Button
              onClick={() => updateMutation.mutate({ name })}
              size="sm"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose your preferred theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors flex-1",
                    theme === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  )}
                >
                  <t.icon className="h-6 w-6" />
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Configure how you receive notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notificationItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <Label htmlFor={item.id} className="font-normal">{item.label}</Label>
                <Switch
                  id={item.id}
                  checked={prefs[item.id] ?? true}
                  onCheckedChange={(checked) => handleTogglePref(item.id, checked)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>Choose which events trigger an email to your inbox</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailNotificationItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <Label htmlFor={item.id} className="font-normal">{item.label}</Label>
                <Switch
                  id={item.id}
                  checked={prefs[item.id] ?? true}
                  onCheckedChange={(checked) => handleTogglePref(item.id, checked)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Product Tour */}
        <Card>
          <CardHeader>
            <CardTitle>Product Tour</CardTitle>
            <CardDescription>Replay the onboarding walkthrough</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetOnboardingTour();
                startOnboardingTour();
              }}
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              Restart Tour
            </Button>
          </CardContent>
        </Card>

        {/* Security / 2FA */}
        <TwoFactorSection />
      </div>
    </>
  );
}

function TwoFactorSection() {
  const { data: status, isLoading } = trpc.auth.get2FAStatus.useQuery();
  const [step, setStep] = useState<"idle" | "setup" | "verify" | "backup" | "disable">("idle");
  const [qrData, setQrData] = useState<{ qrCodeUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState("");

  const utils = trpc.useUtils();
  const enable2FA = trpc.auth.enable2FA.useMutation({
    onSuccess: (data) => { setQrData(data); setStep("verify"); },
    onError: (err) => toast.error(err.message),
  });
  const verify2FA = trpc.auth.verify2FA.useMutation({
    onSuccess: (data) => { setBackupCodes(data.backupCodes); setStep("backup"); utils.auth.get2FAStatus.invalidate(); toast.success("2FA enabled!"); },
    onError: (err) => toast.error(err.message),
  });
  const disable2FA = trpc.auth.disable2FA.useMutation({
    onSuccess: () => { setStep("idle"); setDisableCode(""); utils.auth.get2FAStatus.invalidate(); toast.success("2FA disabled"); },
    onError: (err) => toast.error(err.message),
  });

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Backup codes copied!");
  };

  const downloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "dkflow-2fa-backup-codes.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Card><CardContent className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  const is2FAEnabled = status?.enabled;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Security</CardTitle>
          {is2FAEnabled && <Badge variant="outline" className="text-green-400 border-green-400/30"><ShieldCheck className="h-3 w-3 mr-1" />2FA Active</Badge>}
        </div>
        <CardDescription>Two-factor authentication adds an extra layer of security</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!is2FAEnabled && step === "idle" && (
          <Button onClick={() => enable2FA.mutate()} disabled={enable2FA.isPending}>
            {enable2FA.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
            Enable Two-Factor Authentication
          </Button>
        )}

        {step === "verify" && qrData && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
            <div className="flex justify-center">
              <img src={qrData.qrCodeUrl} alt="2FA QR Code" className="rounded-lg border border-border" width={200} height={200} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Or enter this secret manually:</Label>
              <code className="block text-xs bg-muted p-2 rounded font-mono break-all select-all">{qrData.secret}</code>
            </div>
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} className="max-w-[200px] font-mono text-center tracking-widest" />
                <Button onClick={() => verify2FA.mutate({ code })} disabled={code.length !== 6 || verify2FA.isPending}>
                  {verify2FA.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify
                </Button>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setStep("idle"); setQrData(null); setCode(""); }}>Cancel</Button>
          </div>
        )}

        {step === "backup" && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm font-medium text-yellow-400">Save your backup codes!</p>
              <p className="text-xs text-muted-foreground mt-1">Store these in a safe place. Each code can only be used once.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((c, i) => (
                <code key={i} className="text-xs bg-muted p-2 rounded font-mono text-center">{c}</code>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyBackupCodes}><Copy className="h-3.5 w-3.5 mr-1" />Copy</Button>
              <Button variant="outline" size="sm" onClick={downloadBackupCodes}><Download className="h-3.5 w-3.5 mr-1" />Download</Button>
            </div>
            <Button size="sm" onClick={() => { setStep("idle"); setBackupCodes([]); setCode(""); setQrData(null); }}>Done</Button>
          </div>
        )}

        {is2FAEnabled && step === "idle" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Two-factor authentication is currently enabled.</p>
            <Button variant="destructive" size="sm" onClick={() => setStep("disable")}>
              Disable Two-Factor Authentication
            </Button>
          </div>
        )}

        {step === "disable" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter your current authenticator code to disable 2FA:</p>
            <div className="flex gap-2">
              <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="6-digit code" maxLength={6} className="max-w-[200px] font-mono text-center tracking-widest" />
              <Button variant="destructive" onClick={() => disable2FA.mutate({ code: disableCode })} disabled={disableCode.length < 6 || disable2FA.isPending}>
                {disable2FA.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setStep("idle"); setDisableCode(""); }}>Cancel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
