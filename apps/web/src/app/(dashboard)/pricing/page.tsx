"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuthStore } from "@/stores/auth-store";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import {
  Check, X, Crown, Zap, Users, FolderKanban,
  ListTodo, Upload, Bot, Columns3, Workflow, Plug, Key,
  Webhook, Timer, Briefcase, BarChart3, GanttChart, FileText,
  ChevronDown, Loader2, Shield, Rocket, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { label: "Projects", free: "1", pro: "Unlimited", icon: FolderKanban, category: "core" },
  { label: "Members per workspace", free: "3", pro: "Unlimited", icon: Users, category: "core" },
  { label: "Tasks", free: "100", pro: "Unlimited", icon: ListTodo, category: "core" },
  { label: "File upload limit", free: "5 MB", pro: "50 MB", icon: Upload, category: "core" },
  { label: "AI Features", free: false, pro: true, icon: Bot, category: "advanced" },
  { label: "Custom Fields", free: false, pro: true, icon: Columns3, category: "advanced" },
  { label: "Automations", free: false, pro: true, icon: Workflow, category: "advanced" },
  { label: "Integrations (Slack/Teams)", free: false, pro: true, icon: Plug, category: "advanced" },
  { label: "API Keys", free: false, pro: true, icon: Key, category: "advanced" },
  { label: "Webhooks", free: false, pro: true, icon: Webhook, category: "advanced" },
  { label: "Time Tracking", free: false, pro: true, icon: Timer, category: "advanced" },
  { label: "Portfolio View", free: false, pro: true, icon: Briefcase, category: "advanced" },
  { label: "Advanced Dashboard", free: false, pro: true, icon: BarChart3, category: "advanced" },
  { label: "Gantt / Timeline View", free: false, pro: true, icon: GanttChart, category: "advanced" },
  { label: "Public Forms", free: false, pro: true, icon: FileText, category: "advanced" },
];

const FAQ = [
  { q: "How do I get a license key?", a: "License keys are provided by your administrator or after purchase. Contact your team admin to get a Pro license key." },
  { q: "What happens when my license expires?", a: "Your workspace automatically downgrades to the Free plan. No data is deleted — you just lose access to Pro features until a new key is activated." },
  { q: "Is there a limit on the free plan?", a: "Yes — 1 project, 3 members, 100 tasks, and 5 MB file uploads. Pro removes all limits." },
  { q: "Can one key be used for multiple workspaces?", a: "It depends on the key. Some keys allow multiple activations, others are single-use. Check with your administrator." },
];

export default function PricingPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const { plan, isTrialing, isLoading, refetch } = useSubscription();
  const { workspaceId } = useAuthStore();

  const redeemKey = trpc.subscription.redeemKey.useMutation({
    onSuccess: (data: any) => {
      toast.success(`⚡ Pro activated for ${data.durationDays} days!`);
      setKeyDialogOpen(false);
      setLicenseKey("");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const isPro = plan === "pro";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Pricing" }]} />
      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-amber-500/5" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] -translate-y-1/2" />
          
          <div className="relative max-w-5xl mx-auto px-6 pt-12 pb-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
              <Key className="w-3.5 h-3.5" />
              Activate Pro with a license key
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              <span className="text-foreground">Unlock the full power of</span>{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-amber-400 bg-clip-text text-transparent">DKFlow</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Start free with essential features. Enter a license key to unlock Pro and remove all limits.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 pb-16">
          {/* Plan Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-16">
            {/* Free Plan */}
            <div className="relative rounded-2xl border border-border bg-card backdrop-blur p-8 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Free</h3>
                    <p className="text-xs text-muted-foreground">For individuals & small teams</p>
                  </div>
                </div>
                {plan === "free" && !isTrialing && (
                  <Badge className="bg-muted text-muted-foreground border-border text-xs">Current Plan</Badge>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-foreground">₹0</span>
                  <span className="text-muted-foreground text-sm">/forever</span>
                </div>
                <p className="text-muted-foreground text-sm mt-2">No credit card required. Get started instantly.</p>
              </div>

              <Button disabled variant="outline" className="w-full mb-8 h-11 border-border text-muted-foreground">
                {plan === "free" && !isTrialing ? "Current Plan" : "Free Forever"}
              </Button>

              <div className="space-y-1 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">What&apos;s included</p>
                {FEATURES.map((f) => {
                  const included = f.free !== false;
                  return (
                    <div key={f.label} className={cn(
                      "flex items-center gap-3 py-2 px-3 rounded-lg text-sm",
                      included ? "text-foreground/80" : "text-muted-foreground/50"
                    )}>
                      {included ? (
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                          <X className="w-3 h-3 text-muted-foreground/30" />
                        </div>
                      )}
                      <span className="flex-1">{f.label}</span>
                      {typeof f.free === "string" && (
                        <span className="text-xs text-muted-foreground font-medium">{f.free}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pro Plan */}
            <div className="relative rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-500/[0.08] to-zinc-900/50 backdrop-blur p-8 flex flex-col">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-foreground text-xs font-semibold shadow-lg shadow-indigo-500/25">
                  <Star className="w-3 h-3 fill-current" />
                  Full Power
                </div>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Crown className="w-5 h-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Pro</h3>
                    <p className="text-xs text-muted-foreground">Unlimited everything</p>
                  </div>
                </div>
                {isPro && (
                  <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30 text-xs">
                    Active
                  </Badge>
                )}
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">License Key</span>
                </div>
                <p className="text-muted-foreground text-sm mt-2">Enter a license key to unlock all Pro features instantly.</p>
              </div>

              {isPro ? (
                <Button disabled className="w-full mb-8 h-11 bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                  Pro Active
                </Button>
              ) : (
                <Button
                  className="w-full mb-8 h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-foreground shadow-lg shadow-indigo-500/25 border-0"
                  onClick={() => setKeyDialogOpen(true)}
                >
                  <Key className="w-4 h-4 mr-2" />
                  Activate License Key
                </Button>
              )}

              <div className="space-y-1 flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Everything in Free, plus</p>
                {FEATURES.map((f) => (
                  <div key={f.label} className="flex items-center gap-3 py-2 px-3 rounded-lg text-sm text-foreground/80">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-indigo-400" />
                    </div>
                    <span className="flex-1">{f.label}</span>
                    {typeof f.pro === "string" && (
                      <span className="text-xs text-indigo-400 font-medium">{f.pro}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-foreground text-center mb-2">Compare Plans</h2>
            <p className="text-muted-foreground text-center mb-8">See exactly what you get with each plan</p>
            
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-3 bg-card border-b border-border">
                <div className="px-6 py-4 text-sm font-semibold text-muted-foreground">Feature</div>
                <div className="px-6 py-4 text-sm font-semibold text-muted-foreground text-center">Free</div>
                <div className="px-6 py-4 text-sm font-semibold text-center">
                  <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Pro</span>
                </div>
              </div>
              {FEATURES.map((f, i) => (
                <div key={f.label} className={cn(
                  "grid grid-cols-3 border-b border-border/50",
                  i % 2 === 0 ? "bg-muted/30" : "bg-transparent"
                )}>
                  <div className="px-6 py-3.5 flex items-center gap-2.5 text-sm text-foreground/80">
                    <f.icon className="w-4 h-4 text-muted-foreground" />
                    {f.label}
                  </div>
                  <div className="px-6 py-3.5 flex items-center justify-center text-sm">
                    {f.free === false ? (
                      <X className="w-4 h-4 text-muted-foreground/30" />
                    ) : typeof f.free === "string" ? (
                      <span className="text-muted-foreground">{f.free}</span>
                    ) : (
                      <Check className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="px-6 py-3.5 flex items-center justify-center text-sm">
                    {typeof f.pro === "string" ? (
                      <span className="text-indigo-400 font-medium">{f.pro}</span>
                    ) : (
                      <Check className="w-4 h-4 text-indigo-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust */}
          <div className="flex items-center justify-center gap-8 mb-16 py-8">
            {[
              { icon: Shield, text: "Enterprise-grade security" },
              { icon: Zap, text: "99.9% uptime SLA" },
              { icon: Users, text: "Trusted by teams worldwide" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
                <item.icon className="w-4 h-4 text-muted-foreground/50" />
                {item.text}
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl font-bold text-foreground text-center mb-2">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-center mb-8">Got questions? We&apos;ve got answers.</p>
            <div className="space-y-2">
              {FAQ.map((item, i) => (
                <div key={i} className="rounded-xl border border-border overflow-hidden transition-colors hover:border-border">
                  <button
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
                  >
                    {item.q}
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-4",
                      faqOpen === i && "rotate-180"
                    )} />
                  </button>
                  {faqOpen === i && (
                    <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">{item.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          {!isPro && (
            <div className="text-center pb-8">
              <div className="relative rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 p-10">
                <h3 className="text-2xl font-bold text-foreground mb-2">Ready to unlock Pro?</h3>
                <p className="text-muted-foreground mb-6">Enter your license key to activate all Pro features instantly.</p>
                <Button
                  className="h-12 px-8 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-foreground shadow-lg shadow-indigo-500/25 border-0 text-base"
                  onClick={() => setKeyDialogOpen(true)}
                >
                  <Key className="w-5 h-5 mr-2" />
                  Activate License Key
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* License Key Dialog */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              Activate License Key
            </DialogTitle>
            <DialogDescription>
              Enter your license key to activate Pro features instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="license-key">License Key</Label>
              <Input
                id="license-key"
                placeholder="DK-XXXXXXXX-XXXXXXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                className="font-mono text-center tracking-wider text-lg h-12"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              License keys look like: <code className="px-1 py-0.5 bg-muted rounded text-xs">DK-XXXXXXXX-XXXXXXXX</code>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setKeyDialogOpen(false); setLicenseKey(""); }}>
              Cancel
            </Button>
            <Button
              disabled={!licenseKey.trim() || redeemKey.isPending}
              onClick={() => workspaceId && redeemKey.mutate({ workspaceId, licenseKey: licenseKey.trim() })}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
            >
              {redeemKey.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
