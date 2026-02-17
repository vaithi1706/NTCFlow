"use client";

import { useState } from "react";
import { trpc } from "@/lib/api/trpc";

export function WaitlistForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setStatus("success");
      setEmail("");
    },
    onError: (err) => {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");
    joinMutation.mutate({ email });
  };

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-emerald-400">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        <span className="text-sm font-medium">You&apos;re on the list! Check your email for confirmation 📧</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full">
        <input
          type="email"
          placeholder="Enter your work email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
          required
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 backdrop-blur-sm transition-all"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white hover:from-blue-500 hover:to-violet-500 transition-all disabled:opacity-50 whitespace-nowrap shadow-lg shadow-blue-500/25"
        >
          {status === "loading" ? "Joining..." : "Join Waitlist"}
        </button>
      </form>
      {status === "error" && (
        <p className="text-red-400 text-sm mt-3 text-center">{errorMsg}</p>
      )}
    </div>
  );
}

export function WaitlistCount() {
  const { data } = trpc.waitlist.getCount.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  if (!data) return null;
  return (
    <p className="text-sm text-white/50 mt-4">
      🔥 <span className="text-white/70 font-medium">{data.count}</span> teams already on the waitlist
    </p>
  );
}
