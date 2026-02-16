"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { trpcVanilla, isTRPCError } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const result = await trpcVanilla.auth.login.mutate({ email, password });
      if (result.requires2FA) {
        setNeeds2FA(true);
        setTempToken(result.tempToken!);
        setLoading(false);
        return;
      }
      setAuth(result.user!, result.accessToken!, result.refreshToken!, result.workspaceId ?? undefined);
      toast.success("Welcome back!");
      if (inviteCode) {
        router.push(`/invite/${inviteCode}`);
      } else if (!result.workspaceId) {
        router.push("/onboarding");
      } else {
        router.push("/home");
      }
    } catch (err) {
      if (isTRPCError(err)) {
        toast.error(err.message || "Invalid email or password");
      } else {
        toast.error("Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode) { toast.error("Please enter your code"); return; }
    setLoading(true);
    try {
      const result = await trpcVanilla.auth.verify2FALogin.mutate({ tempToken, code: totpCode });
      setAuth(result.user, result.accessToken, result.refreshToken, result.workspaceId ?? undefined);
      toast.success("Welcome back!");
      if (inviteCode) {
        router.push(`/invite/${inviteCode}`);
      } else if (!result.workspaceId) {
        router.push("/onboarding");
      } else {
        router.push("/home");
      }
    } catch (err) {
      if (isTRPCError(err)) {
        toast.error(err.message || "Invalid code");
      } else {
        toast.error("Invalid code");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl mb-2">
            DK
          </div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your DKFlow account</p>
        </CardHeader>
        <CardContent>
          {!needs2FA ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                <Label htmlFor="remember" className="text-sm text-muted-foreground font-normal cursor-pointer">Remember me</Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign In
              </Button>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => toast("Google login coming soon")}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </Button>
            </form>
          ) : (
            <form onSubmit={handle2FASubmit} className="space-y-4">
              <div className="text-center space-y-2 mb-4">
                <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">🔐</div>
                <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
                <p className="text-sm text-muted-foreground">
                  {useBackup ? "Enter one of your backup codes" : "Enter the 6-digit code from your authenticator app"}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{useBackup ? "Backup Code" : "Authentication Code"}</Label>
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder={useBackup ? "Enter backup code" : "000000"}
                  maxLength={useBackup ? 8 : 6}
                  className="font-mono text-center text-lg tracking-widest"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || totpCode.length < 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify
              </Button>
              <div className="text-center">
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setUseBackup(!useBackup); setTotpCode(""); }}>
                  {useBackup ? "Use authenticator code instead" : "Use a backup code"}
                </button>
              </div>
              <button type="button" className="text-xs text-muted-foreground hover:underline w-full text-center" onClick={() => { setNeeds2FA(false); setTotpCode(""); setTempToken(""); }}>
                ← Back to login
              </button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">Sign up</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
