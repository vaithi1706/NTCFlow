import Link from "next/link";
import {
  LayoutGrid, Sparkles, Target, Shield, Users, Zap, Brain, Search,
  Check, ArrowRight, ChevronRight, BarChart3, TrendingUp, AlertTriangle,
  MessageSquare, Clock, GitBranch, Layers, CalendarDays, Activity,
  Lightbulb, Eye, RefreshCw, Mail, MapPin,
} from "lucide-react";
import { WaitlistForm, WaitlistCount } from "@/components/landing/waitlist-form";
import { FadeIn, CountUp } from "@/components/landing/animated-sections";

/* ─── DATA ─────────────────────────────────────────── */

const features = [
  {
    icon: LayoutGrid,
    title: "10+ Project Views",
    desc: "Board, List, Table, Calendar, Timeline, Roadmap, Backlog, Gantt — work the way your team prefers.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Brain,
    title: "Intelligence Engine",
    desc: "AI that learns your project patterns, detects risks before they happen, and answers any question about your work.",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: Target,
    title: "Sprints & Velocity",
    desc: "Plan sprints with AI, track burndown charts, measure velocity, and run data-driven retrospectives.",
    gradient: "from-emerald-500 to-green-500",
  },
  {
    icon: Zap,
    title: "Goals & OKRs",
    desc: "Set objectives, track key results, align teams to outcomes. Connect goals to tasks automatically.",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    desc: "10+ roles with granular permissions. RBAC across every resource. Audit logs for full compliance.",
    gradient: "from-red-500 to-rose-500",
  },
  {
    icon: Users,
    title: "Real-Time Collaboration",
    desc: "Live updates, comments, @mentions, activity feeds. Your whole team in sync, always.",
    gradient: "from-pink-500 to-fuchsia-500",
  },
];

const aiCategories = [
  {
    name: "Task Intelligence",
    features: ["Auto Task Description", "Smart Breakdown", "Effort Estimation", "Duplicate Detection", "Auto-Triage", "Predictive Due Dates"],
  },
  {
    name: "Project Insights",
    features: ["Project Summary", "Health Score", "Sprint Risk Predictor", "Anomaly Detection", "Workflow Optimizer", "Project Health Dashboard"],
  },
  {
    name: "Team Productivity",
    features: ["AI Standup Reports", "Workload Analysis", "Smart Notifications", "Automation Suggestions", "Meeting Notes → Tasks", "Weekly Digest"],
  },
  {
    name: "Smart Search & Chat",
    features: ["Natural Language Search", "Semantic Search", "AI Project Chat", "Comment Summaries", "Release Notes Generator", "Text Copilot"],
  },
];

const stats = [
  { value: 10, suffix: "+", label: "Project Views" },
  { value: 30, suffix: "+", label: "AI Features" },
  { value: 55, suffix: "+", label: "Data Models" },
  { value: 10, suffix: "+", label: "User Roles" },
];

const steps = [
  {
    num: "01",
    title: "Set Up Your Workspace",
    desc: "Create projects, invite your team, and import existing tasks. Takes less than 5 minutes.",
    icon: Users,
  },
  {
    num: "02",
    title: "Engine Learns Your Patterns",
    desc: "The Intelligence Engine indexes every task, comment, and activity. It learns who's best at what, how accurate your estimates are, and where bottlenecks form.",
    icon: Brain,
  },
  {
    num: "03",
    title: "Get Smarter Every Day",
    desc: "Daily briefings, risk alerts, and proactive recommendations. The more you use DKFlow, the smarter it gets. Your AI project manager never sleeps.",
    icon: Sparkles,
  },
];

const freePlan = [
  "Up to 3 projects",
  "5 team members",
  "Board & List views",
  "Basic AI features",
  "Community support",
];

const proPlan = [
  "Unlimited projects",
  "Unlimited members",
  "All 10+ views",
  "30+ AI features",
  "Intelligence Engine",
  "Custom fields & workflows",
  "Advanced analytics",
  "Priority support",
  "API access",
];

/* ─── PAGE ──────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white antialiased overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.02)_1px,transparent_0)] bg-[size:48px_48px] pointer-events-none" />

      {/* ══════ NAV ══════ */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold shadow-lg shadow-blue-500/20">DK</div>
            <span className="text-lg font-bold tracking-tight">DK<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Flow</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors duration-200">Features</a>
            <a href="#engine" className="hover:text-white transition-colors duration-200">AI Engine</a>
            <a href="#pricing" className="hover:text-white transition-colors duration-200">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex text-sm text-white/50 hover:text-white transition-colors duration-200 px-3 py-2">
              Log in
            </Link>
            <Link href="/register" className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-sm font-medium hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/20">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section className="relative pt-20 sm:pt-28 pb-20 px-4 sm:px-6">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="relative mx-auto max-w-4xl text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/60 mb-8 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Now with Intelligence Engine — AI that learns your project
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Project Management</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">That Thinks With You</span>
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-base sm:text-lg lg:text-xl text-white/45 max-w-2xl mx-auto mb-10 leading-relaxed">
              DKFlow is the only project management platform with an AI brain that learns your team&apos;s patterns, predicts risks before they happen, and gets smarter every day.
            </p>
          </FadeIn>

          <FadeIn delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-8 py-3.5 text-sm font-semibold hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/25 text-center">
                Get Started Free <ArrowRight className="inline h-4 w-4 ml-1" />
              </Link>
              <a href="#engine" className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all text-center backdrop-blur-sm">
                See AI Engine in Action
              </a>
            </div>
          </FadeIn>
        </div>

        {/* Board Mockup */}
        <FadeIn delay={500}>
          <div className="relative mx-auto mt-16 sm:mt-20 max-w-5xl">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-purple-500/10 rounded-2xl blur-xl pointer-events-none" />
            <div className="relative rounded-xl border border-white/10 bg-slate-900/80 p-4 sm:p-6 backdrop-blur-sm shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/70" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                  <div className="h-3 w-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="h-6 w-48 rounded-md bg-white/5 flex items-center justify-center text-[10px] text-white/20">dkflow.in</div>
                </div>
              </div>
              {/* Kanban */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { name: "To Do", color: "bg-slate-400", count: 4 },
                  { name: "In Progress", color: "bg-blue-400", count: 3 },
                  { name: "Review", color: "bg-amber-400", count: 2 },
                  { name: "Done", color: "bg-emerald-400", count: 5 },
                ].map((col) => (
                  <div key={col.name} className="space-y-2.5">
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs font-medium text-white/40 uppercase tracking-wider">
                      <div className={`h-2 w-2 rounded-full ${col.color}`} />
                      <span className="truncate">{col.name}</span>
                      <span className="ml-auto text-white/20">{col.count}</span>
                    </div>
                    {Array.from({ length: Math.min(col.count, 3) }).map((_, i) => (
                      <div key={i} className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 sm:p-3 space-y-2">
                        <div className="h-2.5 rounded bg-white/10 w-4/5" />
                        <div className="h-2 rounded bg-white/5 w-full" />
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <div className={`h-4 w-12 rounded-full text-[8px] sm:text-[9px] flex items-center justify-center ${
                            ["bg-blue-500/20 text-blue-400", "bg-violet-500/20 text-violet-400", "bg-emerald-500/20 text-emerald-400"][i % 3]
                          }`}>
                            {["Feature", "Bug", "Task"][i % 3]}
                          </div>
                          <div className="ml-auto h-5 w-5 rounded-full bg-gradient-to-br from-blue-400/40 to-violet-400/40" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ══════ STATS ══════ */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 border-y border-white/5">
        <div className="mx-auto max-w-5xl grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
          {stats.map((s, i) => (
            <FadeIn key={s.label} delay={i * 100} className="text-center">
              <div className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent mb-2">
                <CountUp target={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs sm:text-sm text-white/40">{s.label}</div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ══════ FEATURES ══════ */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <FadeIn className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-medium text-blue-400 mb-3 uppercase tracking-wider">Features</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-4">
              Everything your team needs
            </h2>
            <p className="text-base text-white/40 max-w-xl mx-auto">
              From kanban boards to AI-powered insights — one platform for your entire workflow.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 80}>
                <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-7 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 h-full">
                  <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.gradient} shadow-lg`}>
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ INTELLIGENCE ENGINE — HERO SECTION ══════ */}
      <section id="engine" className="py-20 sm:py-28 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-600/5 via-blue-600/5 to-transparent pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-600/8 rounded-full blur-[200px] pointer-events-none" />

        <div className="relative mx-auto max-w-7xl">
          <FadeIn className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs text-violet-400 mb-6">
              <Brain className="h-3.5 w-3.5" />
              Intelligence Engine — Only in DKFlow
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                Your Project&apos;s AI Brain
              </span>
            </h2>
            <p className="text-base sm:text-lg text-white/40 max-w-2xl mx-auto">
              The Intelligence Engine doesn&apos;t just display data — it learns, thinks, and advises. Like having a senior PM who knows every detail of every project.
            </p>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left — Features */}
            <FadeIn>
              <div className="space-y-6">
                {[
                  {
                    icon: Eye,
                    title: "Learns Your Patterns",
                    desc: "The engine indexes every task, comment, and activity. It learns who's best at what, how accurate your estimates are, and where bottlenecks form.",
                  },
                  {
                    icon: AlertTriangle,
                    title: "Detects Risks Early",
                    desc: "Sprint at risk? Developer stuck for 3 days? Workload imbalance? The engine catches problems days before humans notice.",
                  },
                  {
                    icon: TrendingUp,
                    title: "Predicts & Recommends",
                    desc: "\"This task will take 2x longer than estimated based on 47 similar tasks.\" Get data-driven recommendations, not guesses.",
                  },
                  {
                    icon: MessageSquare,
                    title: "Ask Anything",
                    desc: "\"Who should I assign this to?\" \"Why is the auth module delayed?\" Ask natural questions and get answers backed by real project data.",
                  },
                ].map((item, i) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/10">
                      <item.icon className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                      <h4 className="text-sm sm:text-base font-semibold text-white mb-1">{item.title}</h4>
                      <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>

            {/* Right — Engine Mockup */}
            <FadeIn delay={200}>
              <div className="rounded-2xl border border-violet-500/20 bg-slate-900/80 p-5 sm:p-6 backdrop-blur-sm shadow-2xl shadow-violet-500/5">
                {/* Engine Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">Intelligence Engine</div>
                    <div className="text-[10px] text-white/40">Active — Learning from your project</div>
                  </div>
                  <div className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400">
                    ● Active
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { n: "247", l: "Memories", c: "text-violet-400" },
                    { n: "12", l: "Patterns", c: "text-blue-400" },
                    { n: "5", l: "Insights", c: "text-amber-400" },
                  ].map(s => (
                    <div key={s.l} className="rounded-xl bg-white/[0.04] border border-white/5 p-3 text-center">
                      <div className={`text-xl font-bold ${s.c}`}>{s.n}</div>
                      <div className="text-[9px] text-white/30 uppercase tracking-wider">{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Insight Cards */}
                <div className="space-y-2.5 mb-5">
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium">Sprint &quot;v2.1&quot; at risk</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-red-500/20 text-red-400">Critical</span>
                        </div>
                        <p className="text-[11px] text-white/40">At current pace, 4 tasks won&apos;t be completed. 18/24 done with 2 days left.</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <Activity className="h-3.5 w-3.5 text-yellow-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium">Workload imbalance detected</span>
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-yellow-500/20 text-yellow-400">Warning</span>
                        </div>
                        <p className="text-[11px] text-white/40">Ravi has 14 tasks while Arun has only 3. Consider rebalancing.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ask Engine */}
                <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-[11px] font-medium text-white/50">Ask Engine</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-end">
                      <div className="rounded-lg rounded-tr-sm bg-indigo-600/30 px-3 py-1.5 text-[11px] text-white/70 max-w-[80%]">
                        Who should I assign the auth module to?
                      </div>
                    </div>
                    <div className="flex">
                      <div className="rounded-lg rounded-tl-sm bg-white/[0.06] px-3 py-1.5 text-[11px] text-white/50 max-w-[85%]">
                        Based on 23 similar tasks, Ravi is 40% faster on auth tasks. However, he&apos;s at capacity. Suggest Priya — she completed 5 auth tasks last sprint with 95% accuracy.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════ AI FEATURES ══════ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <FadeIn className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-medium text-violet-400 mb-3 uppercase tracking-wider">AI-Powered</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent mb-4">
              30+ AI Features Built In
            </h2>
            <p className="text-base text-white/40 max-w-xl mx-auto">
              Every feature powered by real AI — not just a chatbot wrapper. Each one learns from your project data.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {aiCategories.map((cat, ci) => (
              <FadeIn key={cat.name} delay={ci * 100}>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 h-full">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    <h3 className="text-sm font-semibold">{cat.name}</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {cat.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-white/45">
                        <div className="h-1.5 w-1.5 rounded-full bg-violet-400/60 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ HOW IT WORKS ══════ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <FadeIn className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-medium text-emerald-400 mb-3 uppercase tracking-wider">How It Works</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              Three steps to smarter projects
            </h2>
          </FadeIn>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {steps.map((step, i) => (
              <FadeIn key={step.num} delay={i * 150}>
                <div className="relative text-center sm:text-left">
                  <div className="text-5xl sm:text-6xl font-bold text-white/[0.03] mb-4">{step.num}</div>
                  <div className="flex justify-center sm:justify-start mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/5 flex items-center justify-center">
                      <step.icon className="h-5 w-5 text-blue-400" />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PRICING ══════ */}
      <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <FadeIn className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-medium text-blue-400 mb-3 uppercase tracking-wider">Pricing</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-4">
              Start free, scale when ready
            </h2>
            <p className="text-base text-white/40 max-w-lg mx-auto">
              No credit card required. No hidden fees. Upgrade when your team needs more.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-5 sm:gap-6">
            {/* Free */}
            <FadeIn>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 h-full flex flex-col">
                <h3 className="text-lg font-semibold mb-1">Free</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold">$0</span>
                </div>
                <p className="text-sm text-white/30 mb-6">Perfect for small teams getting started</p>
                <ul className="space-y-3 text-sm text-white/50 mb-8 flex-1">
                  {freePlan.map(f => (
                    <li key={f} className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-white/20 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="block text-center rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all">
                  Get Started Free
                </Link>
              </div>
            </FadeIn>

            {/* Pro */}
            <FadeIn delay={100}>
              <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-b from-blue-500/[0.08] to-violet-500/[0.04] p-6 sm:p-8 h-full flex flex-col relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-1 text-[10px] font-semibold uppercase rounded-full">Most Popular</div>
                <h3 className="text-lg font-semibold mb-1">Pro</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold">$12</span>
                  <span className="text-sm text-white/40">/user/month</span>
                </div>
                <p className="text-sm text-white/30 mb-6">For teams that want the full AI advantage</p>
                <ul className="space-y-3 text-sm text-white/50 mb-8 flex-1">
                  {proPlan.map(f => (
                    <li key={f} className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-blue-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="block text-center rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-semibold shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-violet-500 transition-all">
                  Start Pro Trial
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════ CTA ══════ */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-blue-600/5 via-violet-600/3 to-transparent pointer-events-none" />
        <div className="relative mx-auto max-w-2xl text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-4">
              Ready to let AI manage your projects?
            </h2>
            <p className="text-white/40 mb-8 text-base">
              Join teams already using DKFlow to ship faster and smarter.
            </p>
            <div className="flex flex-col items-center gap-4">
              <WaitlistForm />
              <WaitlistCount />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="border-t border-white/5 py-10 sm:py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-600 text-[10px] font-bold">DK</div>
              <span className="font-bold">DK<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">Flow</span></span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/30">
              <a href="#features" className="hover:text-white/60 transition-colors">Features</a>
              <a href="#engine" className="hover:text-white/60 transition-colors">AI Engine</a>
              <a href="#pricing" className="hover:text-white/60 transition-colors">Pricing</a>
              <Link href="/login" className="hover:text-white/60 transition-colors">Login</Link>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/20">
              <MapPin className="h-3 w-3" />
              Built with ❤️ in India
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-white/15">
            © {new Date().getFullYear()} DKFlow. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
