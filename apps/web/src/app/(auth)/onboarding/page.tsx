"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Users, Mail, ArrowRight, ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { trpcVanilla, isTRPCError } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

type Step = "welcome" | "choice" | "create" | "join" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setWorkspaceId, hydrateFromStorage } = useAuthStore();
  const [step, setStep] = useState<Step>("welcome");
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrateFromStorage();
    setHydrated(true);
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (hydrated && !user) {
      router.push("/login");
    }
  }, [hydrated, user, router]);

  const handleCreateWorkspace = async () => {
    if (!workspaceName.trim()) { toast.error("Please enter a workspace name"); return; }
    setLoading(true);
    try {
      const ws = await trpcVanilla.workspace.create.mutate({ name: workspaceName.trim() });
      await trpcVanilla.workspace.completeOnboarding.mutate();
      setWorkspaceId(ws.id);
      setStep("done");
      toast.success("Workspace created!");
      setTimeout(() => router.push("/home"), 1500);
    } catch (err) {
      if (isTRPCError(err)) toast.error(err.message);
      else toast.error("Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) { toast.error("Please enter an invite code"); return; }
    setLoading(true);
    try {
      // Extract code from URL if pasted full link
      let code = inviteCode.trim();
      const urlMatch = code.match(/\/invite\/([^/?]+)/);
      if (urlMatch) code = urlMatch[1];

      const result = await trpcVanilla.workspace.joinByInvite.mutate({ code });
      await trpcVanilla.workspace.completeOnboarding.mutate();
      setWorkspaceId(result.workspaceId);
      setStep("done");
      toast.success("Joined workspace!");
      setTimeout(() => router.push("/home"), 1500);
    } catch (err) {
      if (isTRPCError(err)) toast.error(err.message);
      else toast.error("Invalid or expired invite");
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl mb-4">
            DK
          </div>
        </div>

        {step === "welcome" && (
          <Card className="border-border">
            <CardHeader className="text-center space-y-3 pb-2">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold">Welcome to DKFlow, {user.name}! 👋</h1>
              <p className="text-muted-foreground">
                Let&apos;s get you set up. It&apos;ll only take a moment.
              </p>
            </CardHeader>
            <CardContent className="pt-6 pb-8">
              <Button onClick={() => setStep("choice")} className="w-full gap-2" size="lg">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "choice" && (
          <Card className="border-border">
            <CardHeader className="text-center space-y-2 pb-2">
              <h1 className="text-xl font-bold">How would you like to start?</h1>
              <p className="text-sm text-muted-foreground">Choose one of the options below</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 pb-6">
              <button
                onClick={() => setStep("create")}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">Create a Workspace</p>
                  <p className="text-sm text-muted-foreground">Start fresh with your own workspace</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => setStep("join")}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left group"
              >
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">Join a Workspace</p>
                  <p className="text-sm text-muted-foreground">Enter an invite code or link</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              <div className="pt-2">
                <p className="text-xs text-center text-muted-foreground">
                  <Mail className="inline h-3 w-3 mr-1" />
                  If someone invited you by email, check your inbox for an invite link.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "create" && (
          <Card className="border-border">
            <CardHeader className="text-center space-y-2 pb-2">
              <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold">Create your Workspace</h1>
              <p className="text-sm text-muted-foreground">This is where your team will collaborate</p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 pb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Workspace Name</label>
                <Input
                  placeholder="e.g. Acme Engineering"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                />
              </div>
              <Button onClick={handleCreateWorkspace} disabled={loading || !workspaceName.trim()} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                {loading ? "Creating..." : "Create Workspace"}
              </Button>
              <Button variant="ghost" onClick={() => setStep("choice")} className="w-full gap-2 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "join" && (
          <Card className="border-border">
            <CardHeader className="text-center space-y-2 pb-2">
              <div className="mx-auto h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <h1 className="text-xl font-bold">Join a Workspace</h1>
              <p className="text-sm text-muted-foreground">Paste your invite code or link</p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 pb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Invite Code or Link</label>
                <Input
                  placeholder="Paste invite link or code..."
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                />
              </div>
              <Button onClick={handleJoinByCode} disabled={loading || !inviteCode.trim()} className="w-full gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                {loading ? "Joining..." : "Join Workspace"}
              </Button>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Don&apos;t have an invite? Ask your team admin to send you one.
                </p>
              </div>
              <Button variant="ghost" onClick={() => setStep("choice")} className="w-full gap-2 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "done" && (
          <Card className="border-border">
            <CardHeader className="text-center space-y-3 pb-2">
              <div className="mx-auto h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <h1 className="text-xl font-bold">You&apos;re all set! 🎉</h1>
              <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
            </CardHeader>
            <CardContent className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
