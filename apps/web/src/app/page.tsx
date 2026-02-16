import Link from "next/link";
import {
  LayoutGrid, Users, Zap, Shield, BarChart3, Globe,
  CheckCircle, ArrowRight, Star, Quote,
} from "lucide-react";

const features = [
  { icon: LayoutGrid, title: "Kanban Boards", desc: "Drag-and-drop task management with customizable columns and workflows." },
  { icon: Users, title: "Team Collaboration", desc: "Real-time updates, comments, @mentions, and shared workspaces." },
  { icon: Zap, title: "Multiple Views", desc: "Board, List, Table, Calendar, Timeline, and Roadmap views for every workflow." },
  { icon: Shield, title: "Role-Based Access", desc: "Fine-grained permissions with Owner, Admin, Member, and Viewer roles." },
  { icon: BarChart3, title: "Progress Tracking", desc: "Checklists, due dates, priorities, sprints, and labels to stay on track." },
  { icon: Globe, title: "Works Everywhere", desc: "Responsive design that works on desktop, tablet, and mobile." },
];

const plans = [
  { name: "Free", price: "$0", period: "forever", features: ["Up to 5 projects", "Unlimited tasks", "3 team members", "Board & List views", "Basic reporting"], cta: "Get Started Free", highlight: false },
  { name: "Pro", price: "$12", period: "/user/month", features: ["Unlimited projects", "Unlimited tasks", "Unlimited members", "All views incl. Roadmap", "Priority support", "Custom fields", "Time tracking", "AI task assistant"], cta: "Start Free Trial", highlight: true },
  { name: "Enterprise", price: "Custom", period: "", features: ["Everything in Pro", "SSO & SAML", "Audit logs", "Dedicated support", "SLA guarantee", "On-premise option"], cta: "Contact Sales", highlight: false },
];

const testimonials = [
  { name: "Sarah Chen", role: "Engineering Lead, TechCorp", text: "DKFlow replaced three tools for us. The board and timeline views are exactly what our team needed.", avatar: "SC" },
  { name: "Marcus Rivera", role: "Product Manager, StartupXYZ", text: "The sprint management and roadmap views give us clarity we never had. Our velocity increased 40%.", avatar: "MR" },
  { name: "Aisha Patel", role: "CTO, DesignStudio", text: "Simple enough for designers, powerful enough for engineers. DKFlow just works.", avatar: "AP" },
];

const screenshots = [
  { title: "Kanban Board", gradient: "from-blue-600 to-indigo-700" },
  { title: "Timeline View", gradient: "from-emerald-600 to-teal-700" },
  { title: "Project Dashboard", gradient: "from-purple-600 to-pink-700" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">DK</div>
            <span className="font-bold text-lg">DK<span className="text-primary">Flow</span></span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
              Sign In
            </Link>
            <Link href="/register" className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-sm text-muted-foreground mb-2">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
            <span>Modern project management for fast-moving teams</span>
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
            Manage projects<br />
            <span className="text-primary">without the chaos</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            DKFlow gives your team the clarity to ship faster. Kanban boards, multiple views,
            real-time collaboration — everything you need, nothing you don&apos;t.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity text-lg"
            >
              Get Started Free <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-muted transition-colors text-lg"
            >
              Sign In
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">No credit card required · Free forever plan</p>
        </div>
      </section>

      {/* Screenshots / Mockups */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2">See it in action</h2>
            <p className="text-muted-foreground">Multiple views for every workflow</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {screenshots.map((s) => (
              <div key={s.title} className="rounded-xl overflow-hidden border border-border">
                <div className={`bg-gradient-to-br ${s.gradient} h-48 flex items-center justify-center`}>
                  <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3">
                    <span className="text-white font-medium text-sm">{s.title}</span>
                  </div>
                </div>
                <div className="bg-card p-3 text-center">
                  <span className="text-sm text-muted-foreground">{s.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Everything your team needs</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Powerful features to help you plan, track, and deliver projects on time.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Loved by teams everywhere</h2>
            <p className="text-muted-foreground text-lg">See what our users have to say</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-card border border-border rounded-xl p-6">
                <Quote className="h-5 w-5 text-primary/40 mb-3" />
                <p className="text-sm text-foreground/90 mb-4 leading-relaxed">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Simple, transparent pricing</h2>
            <p className="text-muted-foreground text-lg">Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 flex flex-col ${
                  plan.highlight
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-lg scale-[1.02]"
                    : "border-border bg-card"
                }`}
              >
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="mt-3 mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`text-center py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border hover:bg-muted"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to streamline your workflow?</h2>
          <p className="text-muted-foreground text-lg">
            Join teams who use DKFlow to ship faster and stay organized.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity text-lg"
          >
            Get Started Free <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">DK</div>
            <span>DKFlow</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Get Started</Link>
          </div>
          <p>© {new Date().getFullYear()} DKFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
