"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { Users, CheckCircle2, LogIn, Loader2 } from "lucide-react";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, hydrateFromStorage } = useAuthStore();
  const code = params.code as string;
  const [joined, setJoined] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate auth from localStorage on mount
  useEffect(() => {
    hydrateFromStorage();
    setHydrated(true);
  }, [hydrateFromStorage]);

  const joinMutation = trpc.workspace.joinByInvite.useMutation({
    onSuccess: () => {
      setJoined(true);
      toast.success("You've joined the workspace! Redirecting...");
      setTimeout(() => router.push("/home"), 2000);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to join workspace. The invite may have expired.");
    },
  });

  const handleJoin = () => {
    if (!code) return;
    joinMutation.mutate({ code });
  };

  // Show loading while hydrating
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Skeleton className="h-64 w-96 rounded-xl" />
      </div>
    );
  }

  // User is logged in — show join button
  if (user) {
    if (joined) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="bg-muted border-border max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <CardTitle>Welcome to the team!</CardTitle>
              <CardDescription>Redirecting to your dashboard...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="bg-muted border-border max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <CardTitle>Join Workspace</CardTitle>
            <CardDescription>
              Hi <strong className="text-foreground">{user.name}</strong>, you've been invited to join a workspace on DKFlow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full gap-2" 
              onClick={handleJoin}
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              {joinMutation.isPending ? "Joining..." : "Accept & Join Workspace"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Logged in as {user.email}. <button onClick={() => { useAuthStore.getState().logout(); router.push(`/login?invite=${code}`); }} className="text-blue-400 hover:underline">Switch account</button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not logged in — show register/login options
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="bg-muted border-border max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <CardTitle>You've been invited!</CardTitle>
          <CardDescription>
            You need an account to join this workspace. Please sign up or log in first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full gap-2" onClick={() => router.push(`/register?invite=${code}`)}>
            Create Account
          </Button>
          <Button variant="outline" className="w-full gap-2" onClick={() => router.push(`/login?invite=${code}`)}>
            <LogIn className="w-4 h-4" />
            Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
