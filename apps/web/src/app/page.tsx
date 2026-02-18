import Link from "next/link";
import {
  LayoutGrid, Sparkles, Target, Shield, Users, Zap,
  Check, ArrowRight, Twitter, Linkedin, Github,
} from "lucide-react";
import { WaitlistForm, WaitlistCount } from "@/components/landing/waitlist-form";
import { FadeIn, CountUp } from "@/components/landing/animated-sections";

/* ─── DATA ─────────────────────────────────────────── */

const features = [
  { icon: LayoutGrid, title: "Multiple Views", desc: "Board, List, Table, Calendar, Timeline, Roadmap — switch in one click." },
  { icon: Sparkles, title: "18 AI Features", desc: "Auto-assign, summarize, generate subtasks, smart labels, and more." },
  { icon: Target, title: "Agile Sprints", desc: "Plan sprints, track velocity, burn-down charts, and retrospectives." },
  { icon: Zap, title: "Goals & OKRs", desc: "Set objectives, track key results, and align teams to outcomes." },
  { icon: Shield, title: "Enterprise RBAC", desc: "10+ roles with fine-grained permissions across every resource." },
  { icon: Users, title: "Real-Time Collab", desc: "Live cursors, instant updates, comments, and @mentions." },
];

const aiFeatures = [
  "Smart Task Assignment", "Auto Summarization", "Subtask Generation", "Label Suggestions",
  "Sprint Planning AI", "Duplicate Detection", "Priority Prediction", "Effort Estimation",
  "Status Automation", "Comment Insights", "Risk Assessment", "Dependency Mapping",
  "Blocker Detection", "Velocity Forecasting", "Scope Creep Alerts", "Template Generation",
  "Meeting Notes → Tasks", "Natural Language Search",
];

const stats = [
  { value: 40, suffix: "+", label: "Views & Pages" },
  { value: 18, suffix: "", label: "AI Features" },
  { value: 55, suffix: "+", label: "Data Models" },
  { value: 10, suffix: "+", label: "User Roles" },
];

const testimonials = [
  { name: "Sarah Chen", role: "Engineering Lead, TechCorp", text: "DKFlow replaced three tools for us. The AI features alone saved our team 10 hours a week on task management.", avatar: "SC" },
  { name: "Marcus Rivera", role: "Product Manager, StartupXYZ", text: "The sprint planning AI and velocity forecasting gave us clarity we never had. Our ship rate increased 40%.", avatar: "MR" },
  { name: "Aisha Patel", role: "CTO, DesignStudio", text: "Simple enough for designers, powerful enough for engineers. Best project management tool we've used.", avatar: "AP" },
];

const logos = ["TechCorp", "StartupXYZ", "DesignStudio", "CloudBase", "DataSync", "NexaFlow", "Buildr", "Quantum"];

/* ─── PAGE ──────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white antialiased overflow-x-hidden">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_0)] bg-[size:40px_40px] pointer-events-none" />

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold">DK</div>
            <span className="text-lg font-bold tracking-tight">DK<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Flow</span></span>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            
            
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-24 pb-20 px-6">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-violet-600/15 rounded-full blur-[128px] pointer-events-none" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/60 mb-8 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Now in Early Access
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            <span className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">Project Management,</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">Powered by AI</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            DKFlow brings together boards, sprints, goals, and 18 AI features in one platform. Built for teams that ship fast.
          </p>

          <div className="flex flex-col items-center gap-4">
            <WaitlistForm />
            <WaitlistCount />
          </div>
        </div>

        {/* Board mockup */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm shadow-2xl shadow-blue-500/5">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="flex gap-1.5"><div className="h-3 w-3 rounded-full bg-red-500/60" /><div className="h-3 w-3 rounded-full bg-yellow-500/60" /><div className="h-3 w-3 rounded-full bg-green-500/60" /></div>
              <div className="ml-4 h-6 w-32 rounded bg-white/5" />
              <div className="ml-auto flex gap-2">{[1,2,3].map(i=><div key={i} className="h-6 w-16 rounded bg-white/5" />)}</div>
            </div>
            {/* Kanban columns */}
            <div className="grid grid-cols-4 gap-4">
              {["To Do", "In Progress", "Review", "Done"].map((col, ci) => (
                <div key={col} className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-white/40 uppercase tracking-wider">
                    <div className={`h-2 w-2 rounded-full ${["bg-slate-400","bg-blue-400","bg-amber-400","bg-emerald-400"][ci]}`} />
                    {col}
                    <span className="ml-auto text-white/20">{[3,2,2,4][ci]}</span>
                  </div>
                  {Array.from({ length: [3,2,2,4][ci] }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-white/5 bg-white/[0.03] p-3 space-y-2">
                      <div className="h-3 rounded bg-white/10 w-3/4" />
                      <div className="h-2 rounded bg-white/5 w-full" />
                      <div className="flex gap-1.5 pt-1">
                        <div className={`h-4 w-12 rounded-full text-[9px] flex items-center justify-center ${["bg-blue-500/20 text-blue-400","bg-violet-500/20 text-violet-400","bg-emerald-500/20 text-emerald-400"][i % 3]}`}>
                          {["Feature","Bug","Task"][i % 3]}
                        </div>
                        <div className="ml-auto h-5 w-5 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 opacity-40" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGOS / TRUST BAR ── */}
      <section className="border-y border-white/5 py-12 overflow-hidden">
        <p className="text-center text-xs uppercase tracking-widest text-white/30 mb-8">Trusted by teams at</p>
        <div className="relative">
          <div className="flex animate-marquee gap-16 whitespace-nowrap">
            {[...logos, ...logos].map((name, i) => (
              <span key={i} className="text-lg font-semibold text-white/15 select-none">{name}</span>
            ))}
          </div>
        </div>
        <style>{`
          @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .animate-marquee { animation: marquee 30s linear infinite; }
        `}</style>
      </section>

      {/* ── FEATURES GRID ── */}
      <section id="features" className="py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-medium text-blue-400 mb-3 uppercase tracking-wider">Features</p>
            <h2 className="text-3xl sm:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Everything your team needs
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 80}>
                <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-blue-400">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENTO GRID ── */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-medium text-violet-400 mb-3 uppercase tracking-wider">Product</p>
            <h2 className="text-3xl sm:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Built for modern teams
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Board view — large */}
            <FadeIn className="md:col-span-4">
              <div className="group h-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-blue-500/20 transition-all duration-500">
                <h3 className="text-sm font-semibold text-white/70 mb-4">Kanban Board</h3>
                <div className="grid grid-cols-3 gap-3">
                  {["To Do", "In Progress", "Done"].map((c, ci) => (
                    <div key={c} className="space-y-2">
                      <div className="text-[10px] text-white/30 uppercase">{c}</div>
                      {[1,2].map(j => (
                        <div key={j} className="rounded-md bg-white/[0.04] border border-white/5 p-2.5">
                          <div className="h-2 bg-white/10 rounded w-4/5 mb-1.5" />
                          <div className="h-1.5 bg-white/5 rounded w-3/5" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* AI Chat */}
            <FadeIn className="md:col-span-2" delay={100}>
              <div className="group h-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-violet-500/20 transition-all duration-500">
                <h3 className="text-sm font-semibold text-white/70 mb-4">AI Assistant</h3>
                <div className="space-y-3">
                  <div className="flex justify-end"><div className="rounded-lg rounded-tr-sm bg-blue-600/30 px-3 py-2 text-xs text-white/70 max-w-[80%]">Summarize this sprint</div></div>
                  <div className="flex"><div className="rounded-lg rounded-tl-sm bg-white/[0.06] px-3 py-2 text-xs text-white/50 max-w-[85%]">Sprint 12 completed 34 tasks across 3 epics. Velocity was 89 points, up 12% from last sprint...</div></div>
                  <div className="flex justify-end"><div className="rounded-lg rounded-tr-sm bg-blue-600/30 px-3 py-2 text-xs text-white/70 max-w-[80%]">Any blockers?</div></div>
                </div>
              </div>
            </FadeIn>

            {/* Sprint chart */}
            <FadeIn className="md:col-span-3" delay={200}>
              <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-emerald-500/20 transition-all duration-500">
                <h3 className="text-sm font-semibold text-white/70 mb-4">Sprint Burndown</h3>
                <svg viewBox="0 0 300 100" className="w-full h-24">
                  <line x1="0" y1="0" x2="300" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4" />
                  <polyline fill="none" stroke="url(#grad)" strokeWidth="2" points="0,5 50,15 100,30 150,38 200,55 250,70 300,85" />
                  <defs><linearGradient id="grad" x1="0" y1="0" x2="300" y2="0"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient></defs>
                </svg>
              </div>
            </FadeIn>

            {/* Dashboard */}
            <FadeIn className="md:col-span-3" delay={300}>
              <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-amber-500/20 transition-all duration-500">
                <h3 className="text-sm font-semibold text-white/70 mb-4">Dashboard</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[{ n: "89", l: "Points" }, { n: "34", l: "Tasks" }, { n: "96%", l: "On Track" }].map(s => (
                    <div key={s.l} className="rounded-md bg-white/[0.04] p-3 text-center">
                      <div className="text-lg font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">{s.n}</div>
                      <div className="text-[10px] text-white/30">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── AI FEATURES ── */}
      <section className="py-28 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-600/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-6xl">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-medium text-violet-400 mb-3 uppercase tracking-wider">AI-Powered</p>
            <h2 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              18 AI Features That Actually Work
            </h2>
          </FadeIn>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
            {aiFeatures.map((f, i) => (
              <FadeIn key={f} delay={i * 30}>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-center hover:bg-white/[0.05] hover:border-violet-500/20 transition-all">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400 mx-auto mb-1.5" />
                  <span className="text-[11px] text-white/50 leading-tight">{f}</span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-4xl grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <FadeIn key={s.label} delay={i * 100} className="text-center">
              <div className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent mb-2">
                <CountUp target={s.value} suffix={s.suffix} />
              </div>
              <div className="text-sm text-white/40">{s.label}</div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-28 px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Loved by teams
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-4">
            {testimonials.map((t, i) => (
              <FadeIn key={t.name} delay={i * 100}>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 h-full flex flex-col">
                  <p className="text-sm text-white/50 leading-relaxed flex-1 mb-6">&ldquo;{t.text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold">{t.avatar}</div>
                    <div>
                      <div className="text-sm font-medium text-white/80">{t.name}</div>
                      <div className="text-xs text-white/30">{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-28 px-6">
        <div className="mx-auto max-w-3xl">
          <FadeIn className="text-center mb-16">
            <p className="text-sm font-medium text-blue-400 mb-3 uppercase tracking-wider">Pricing</p>
            <h2 className="text-3xl sm:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Simple, transparent pricing
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Free */}
            <FadeIn>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 h-full">
                <h3 className="text-lg font-semibold mb-1">Free</h3>
                <div className="text-3xl font-bold mb-1">$0</div>
                <p className="text-sm text-white/30 mb-6">Forever free for small teams</p>
                <ul className="space-y-3 text-sm text-white/50 mb-8">
                  {["3 projects", "5 team members", "Board & List views", "Basic reporting", "Community support"].map(f => (
                    <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-white/20" />{f}</li>
                  ))}
                </ul>
                <span className="block text-center rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium opacity-50 cursor-not-allowed">
                  Join Waitlist
                </span>
              </div>
            </FadeIn>

            {/* Pro */}
            <FadeIn delay={100}>
              <div className="rounded-xl border border-blue-500/30 bg-gradient-to-b from-blue-500/[0.08] to-violet-500/[0.04] p-8 h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-1 text-[10px] font-semibold uppercase rounded-bl-lg">Popular</div>
                <h3 className="text-lg font-semibold mb-1">Pro</h3>
                <div className="text-3xl font-bold mb-1">$12<span className="text-base font-normal text-white/40">/user/mo</span></div>
                <p className="text-sm text-white/30 mb-6">For growing teams that need more</p>
                <ul className="space-y-3 text-sm text-white/50 mb-8">
                  {["Unlimited projects", "Unlimited members", "All views & features", "18 AI features", "Priority support", "Custom fields & workflows"].map(f => (
                    <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-400" />{f}</li>
                  ))}
                </ul>
                <span className="block text-center rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 py-2.5 text-sm font-semibold shadow-lg shadow-blue-500/20 cursor-pointer">
                  Activate with License Key
                </span>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-2xl text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-4">
              Ready to transform how your team works?
            </h2>
            <p className="text-white/40 mb-10">No credit card required. Free plan available.</p>
            <div className="flex flex-col items-center gap-4">
              <WaitlistForm compact />
              <WaitlistCount />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-600 text-[10px] font-bold">DK</div>
            <span className="font-bold">DK<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Flow</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <a href="#features" className="hover:text-white/60 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white/60 transition-colors">Pricing</a>
            <a href="#waitlist" className="hover:text-white/60 transition-colors">Join Waitlist</a>
          </div>
          <div className="flex items-center gap-4 text-white/20">
            <Twitter className="h-4 w-4 hover:text-white/40 cursor-pointer transition-colors" />
            <Linkedin className="h-4 w-4 hover:text-white/40 cursor-pointer transition-colors" />
            <Github className="h-4 w-4 hover:text-white/40 cursor-pointer transition-colors" />
          </div>
        </div>
        <p className="text-center text-xs text-white/20 mt-8">Built with ❤️ in India</p>
      </footer>
    </div>
  );
}
