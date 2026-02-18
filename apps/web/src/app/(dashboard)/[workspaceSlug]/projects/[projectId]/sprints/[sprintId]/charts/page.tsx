"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/api/trpc";
import { useProjectData } from "@/hooks/use-project-data";
import { ArrowLeft, Camera, BarChart3, TrendingDown, TrendingUp, Layers } from "lucide-react";
import { toast } from "sonner";

// ─── SVG Chart Helpers ──────────────────────────────────

const CHART_W = 720;
const CHART_H = 320;
const PAD = { top: 30, right: 30, bottom: 50, left: 60 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

const STATUS_COLORS: Record<string, string> = {
  backlog: "#64748b",
  todo: "#f59e0b",
  in_progress: "#3b82f6",
  in_review: "#a855f7",
  done: "#22c55e",
  cancelled: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

function GridLines({ maxY, steps = 5 }: { maxY: number; steps?: number }) {
  const lines = [];
  for (let i = 0; i <= steps; i++) {
    const y = PAD.top + (PLOT_H / steps) * i;
    const val = Math.round(maxY - (maxY / steps) * i);
    lines.push(
      <g key={i}>
        <line x1={PAD.left} y1={y} x2={PAD.left + PLOT_W} y2={y} stroke="#334155" strokeWidth={0.5} />
        <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize={11}>{val}</text>
      </g>
    );
  }
  return <>{lines}</>;
}

function XLabels({ labels, maxLabels = 8 }: { labels: string[]; maxLabels?: number }) {
  const step = Math.max(1, Math.floor(labels.length / maxLabels));
  return (
    <>
      {labels.map((l, i) => {
        if (i % step !== 0 && i !== labels.length - 1) return null;
        const x = PAD.left + (i / Math.max(1, labels.length - 1)) * PLOT_W;
        return (
          <text key={i} x={x} y={PAD.top + PLOT_H + 20} textAnchor="middle" fill="#94a3b8" fontSize={10}>
            {l.slice(5)}
          </text>
        );
      })}
    </>
  );
}

function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function Tooltip({ points, labels, color, dataLabel }: { points: { x: number; y: number; value: number }[]; labels: string[]; color: string; dataLabel: string }) {
  return (
    <>
      {points.map((p, i) => (
        <g key={i} className="group">
          <circle cx={p.x} cy={p.y} r={3} fill={color} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          <circle cx={p.x} cy={p.y} r={12} fill="transparent" className="cursor-pointer" />
          <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <rect x={p.x - 45} y={p.y - 36} width={90} height={28} rx={4} fill="#1e293b" stroke="#475569" strokeWidth={0.5} />
            <text x={p.x} y={p.y - 18} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight={500}>
              {dataLabel}: {p.value}
            </text>
          </g>
        </g>
      ))}
    </>
  );
}

// ─── Burndown Chart ─────────────────────────────────────

function BurndownChart({ sprintId, mode }: { sprintId: string; mode: "points" | "tasks" }) {
  const { data, isLoading } = trpc.sprintChart.getBurndown.useQuery({ sprintId, mode });

  if (isLoading) return <ChartSkeleton />;
  if (!data || data.days.length === 0) return <EmptyChart message="No burndown data available" />;

  const maxY = Math.max(data.total, ...data.days.map(d => d.remaining)) || 1;
  const n = data.days.length;

  const idealPoints = data.days.map((d, i) => ({
    x: PAD.left + (i / Math.max(1, n - 1)) * PLOT_W,
    y: PAD.top + (1 - d.ideal / maxY) * PLOT_H,
    value: Math.round(d.ideal),
  }));

  const actualPoints = data.days.map((d, i) => ({
    x: PAD.left + (i / Math.max(1, n - 1)) * PLOT_W,
    y: PAD.top + (1 - d.remaining / maxY) * PLOT_H,
    value: d.remaining,
  }));

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ maxHeight: 400 }}>
      <rect width={CHART_W} height={CHART_H} rx={8} fill="#0f172a" />
      <GridLines maxY={maxY} />
      <XLabels labels={data.days.map(d => d.date)} />

      {/* Ideal line (dashed) */}
      <path d={pointsToPath(idealPoints)} fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="6,4" opacity={0.6} />
      {/* Actual line */}
      <path d={pointsToPath(actualPoints)} fill="none" stroke="#22c55e" strokeWidth={2.5} />
      {/* Area under actual */}
      <path
        d={`${pointsToPath(actualPoints)} L${PAD.left + PLOT_W},${PAD.top + PLOT_H} L${PAD.left},${PAD.top + PLOT_H} Z`}
        fill="url(#burndownGrad)" opacity={0.15}
      />
      <defs>
        <linearGradient id="burndownGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
        </linearGradient>
      </defs>

      <Tooltip points={actualPoints} labels={data.days.map(d => d.date)} color="#22c55e" dataLabel="Remaining" />

      {/* Legend */}
      <line x1={CHART_W - 220} y1={14} x2={CHART_W - 200} y2={14} stroke="#6366f1" strokeWidth={2} strokeDasharray="4,3" />
      <text x={CHART_W - 195} y={18} fill="#94a3b8" fontSize={11}>Ideal</text>
      <line x1={CHART_W - 140} y1={14} x2={CHART_W - 120} y2={14} stroke="#22c55e" strokeWidth={2.5} />
      <text x={CHART_W - 115} y={18} fill="#94a3b8" fontSize={11}>Actual</text>

      {/* Y axis label */}
      <text x={14} y={CHART_H / 2} textAnchor="middle" fill="#94a3b8" fontSize={11} transform={`rotate(-90, 14, ${CHART_H / 2})`}>
        Remaining {mode === "points" ? "Points" : "Tasks"}
      </text>
    </svg>
  );
}

// ─── Burnup Chart ───────────────────────────────────────

function BurnupChart({ sprintId, mode }: { sprintId: string; mode: "points" | "tasks" }) {
  const { data, isLoading } = trpc.sprintChart.getBurnup.useQuery({ sprintId, mode });

  if (isLoading) return <ChartSkeleton />;
  if (!data || data.days.length === 0) return <EmptyChart message="No burnup data available" />;

  const maxY = Math.max(...data.days.map(d => Math.max(d.completed, d.scope))) || 1;
  const n = data.days.length;

  const scopePoints = data.days.map((d, i) => ({
    x: PAD.left + (i / Math.max(1, n - 1)) * PLOT_W,
    y: PAD.top + (1 - d.scope / maxY) * PLOT_H,
    value: d.scope,
  }));

  const completedPoints = data.days.map((d, i) => ({
    x: PAD.left + (i / Math.max(1, n - 1)) * PLOT_W,
    y: PAD.top + (1 - d.completed / maxY) * PLOT_H,
    value: d.completed,
  }));

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ maxHeight: 400 }}>
      <rect width={CHART_W} height={CHART_H} rx={8} fill="#0f172a" />
      <GridLines maxY={maxY} />
      <XLabels labels={data.days.map(d => d.date)} />

      {/* Scope line */}
      <path d={pointsToPath(scopePoints)} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6,4" />
      {/* Completed line */}
      <path d={pointsToPath(completedPoints)} fill="none" stroke="#22c55e" strokeWidth={2.5} />
      {/* Area under completed */}
      <path
        d={`${pointsToPath(completedPoints)} L${completedPoints[completedPoints.length - 1]?.x ?? PAD.left},${PAD.top + PLOT_H} L${PAD.left},${PAD.top + PLOT_H} Z`}
        fill="url(#burnupGrad)" opacity={0.15}
      />
      <defs>
        <linearGradient id="burnupGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
        </linearGradient>
      </defs>

      <Tooltip points={completedPoints} labels={data.days.map(d => d.date)} color="#22c55e" dataLabel="Done" />
      <Tooltip points={scopePoints} labels={data.days.map(d => d.date)} color="#f59e0b" dataLabel="Scope" />

      {/* Legend */}
      <line x1={CHART_W - 220} y1={14} x2={CHART_W - 200} y2={14} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4,3" />
      <text x={CHART_W - 195} y={18} fill="#94a3b8" fontSize={11}>Scope</text>
      <line x1={CHART_W - 130} y1={14} x2={CHART_W - 110} y2={14} stroke="#22c55e" strokeWidth={2.5} />
      <text x={CHART_W - 105} y={18} fill="#94a3b8" fontSize={11}>Completed</text>

      <text x={14} y={CHART_H / 2} textAnchor="middle" fill="#94a3b8" fontSize={11} transform={`rotate(-90, 14, ${CHART_H / 2})`}>
        {mode === "points" ? "Points" : "Tasks"}
      </text>
    </svg>
  );
}

// ─── Velocity Chart ─────────────────────────────────────

function VelocityChart({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.sprintChart.getVelocity.useQuery({ projectId, count: 10 });

  if (isLoading) return <ChartSkeleton />;
  if (!data || data.sprints.length === 0) return <EmptyChart message="No completed sprints yet" />;

  const maxY = Math.max(...data.sprints.map(s => Math.max(s.completedPoints, s.totalPoints)), 1);
  const n = data.sprints.length;
  const barW = Math.min(50, (PLOT_W / n) * 0.6);
  const gap = PLOT_W / n;

  const avgY = PAD.top + (1 - data.average / maxY) * PLOT_H;

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ maxHeight: 400 }}>
      <rect width={CHART_W} height={CHART_H} rx={8} fill="#0f172a" />
      <GridLines maxY={maxY} />

      {data.sprints.map((s, i) => {
        const x = PAD.left + gap * i + (gap - barW) / 2;
        const h = (s.completedPoints / maxY) * PLOT_H;
        const y = PAD.top + PLOT_H - h;
        const totalH = (s.totalPoints / maxY) * PLOT_H;
        const totalY = PAD.top + PLOT_H - totalH;
        return (
          <g key={s.sprintId} className="group">
            {/* Total bar (background) */}
            <rect x={x} y={totalY} width={barW} height={totalH} rx={3} fill="#334155" opacity={0.5} />
            {/* Completed bar */}
            <rect x={x} y={y} width={barW} height={h} rx={3} fill="#3b82f6" />
            {/* Label */}
            <text x={x + barW / 2} y={PAD.top + PLOT_H + 18} textAnchor="middle" fill="#94a3b8" fontSize={9}>
              {s.sprintName.length > 10 ? s.sprintName.slice(0, 10) + "…" : s.sprintName}
            </text>
            {/* Tooltip */}
            <rect x={x - 10} y={y - 4} width={barW + 20} height={PLOT_H - h + 4} fill="transparent" className="cursor-pointer" />
            <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <rect x={x + barW / 2 - 50} y={y - 38} width={100} height={30} rx={4} fill="#1e293b" stroke="#475569" strokeWidth={0.5} />
              <text x={x + barW / 2} y={y - 18} textAnchor="middle" fill="#e2e8f0" fontSize={11}>{s.completedPoints}/{s.totalPoints} pts</text>
            </g>
          </g>
        );
      })}

      {/* Average line */}
      <line x1={PAD.left} y1={avgY} x2={PAD.left + PLOT_W} y2={avgY} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6,4" />
      <text x={PAD.left + PLOT_W + 4} y={avgY + 4} fill="#f59e0b" fontSize={10}>Avg: {data.average}</text>

      {/* Legend */}
      <rect x={CHART_W - 200} y={8} width={12} height={12} rx={2} fill="#3b82f6" />
      <text x={CHART_W - 184} y={18} fill="#94a3b8" fontSize={11}>Completed</text>
      <rect x={CHART_W - 110} y={8} width={12} height={12} rx={2} fill="#334155" />
      <text x={CHART_W - 94} y={18} fill="#94a3b8" fontSize={11}>Committed</text>

      <text x={14} y={CHART_H / 2} textAnchor="middle" fill="#94a3b8" fontSize={11} transform={`rotate(-90, 14, ${CHART_H / 2})`}>
        Story Points
      </text>
    </svg>
  );
}

// ─── Cumulative Flow Diagram ────────────────────────────

function CumulativeFlowChart({ sprintId }: { sprintId: string }) {
  const { data, isLoading } = trpc.sprintChart.getCumulativeFlow.useQuery({ sprintId });

  if (isLoading) return <ChartSkeleton />;
  if (!data || data.days.length === 0) return <EmptyChart message="No flow data available" />;

  const statuses = data.statuses.filter(s => {
    return data.days.some(d => (d.counts[s] || 0) > 0);
  });
  const n = data.days.length;

  // Stack the values
  const maxY = Math.max(...data.days.map(d => statuses.reduce((s, st) => s + (d.counts[st] || 0), 0)), 1);

  // For each status, build a top-line array (cumulative from bottom)
  const stackedAreas = useMemo(() => {
    const areas: { status: string; path: string; color: string }[] = [];

    for (let si = statuses.length - 1; si >= 0; si--) {
      const status = statuses[si]!;
      const topPoints: { x: number; y: number }[] = [];
      const bottomPoints: { x: number; y: number }[] = [];

      for (let di = 0; di < n; di++) {
        const x = PAD.left + (di / Math.max(1, n - 1)) * PLOT_W;

        // Sum statuses below this one (si+1 to end)
        let below = 0;
        for (let k = si + 1; k < statuses.length; k++) {
          below += data.days[di]!.counts[statuses[k]!] || 0;
        }
        const current = data.days[di]!.counts[status] || 0;

        const topY = PAD.top + (1 - (below + current) / maxY) * PLOT_H;
        const bottomY = PAD.top + (1 - below / maxY) * PLOT_H;

        topPoints.push({ x, y: topY });
        bottomPoints.push({ x, y: bottomY });
      }

      const topPath = topPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const bottomPath = bottomPoints.reverse().map((p, i) => `${i === 0 ? "L" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

      areas.push({
        status,
        path: `${topPath} ${bottomPath} Z`,
        color: STATUS_COLORS[status] || "#64748b",
      });
    }

    return areas.reverse();
  }, [data, statuses, n]);

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ maxHeight: 400 }}>
      <rect width={CHART_W} height={CHART_H} rx={8} fill="#0f172a" />
      <GridLines maxY={maxY} />
      <XLabels labels={data.days.map(d => d.date)} />

      {stackedAreas.map(area => (
        <path key={area.status} d={area.path} fill={area.color} opacity={0.7} />
      ))}

      {/* Legend */}
      <g>
        {statuses.map((status, i) => (
          <g key={status} transform={`translate(${PAD.left + i * 90}, ${CHART_H - 10})`}>
            <rect width={10} height={10} rx={2} fill={STATUS_COLORS[status] || "#64748b"} />
            <text x={14} y={9} fill="#94a3b8" fontSize={10}>{STATUS_LABELS[status] || status}</text>
          </g>
        ))}
      </g>

      <text x={14} y={CHART_H / 2} textAnchor="middle" fill="#94a3b8" fontSize={11} transform={`rotate(-90, 14, ${CHART_H / 2})`}>
        Tasks
      </text>
    </svg>
  );
}

// ─── Utility Components ─────────────────────────────────

function ChartSkeleton() {
  return <div className="h-[300px] rounded-lg bg-muted animate-pulse" />;
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[300px] rounded-lg bg-muted flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────

export default function SprintChartsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const sprintId = params.sprintId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const { project } = useProjectData(projectId);

  const [mode, setMode] = useState<"points" | "tasks">("points");

  const { data: sprints } = trpc.sprint.list.useQuery({ projectId });
  const sprint = sprints?.find(s => s.id === sprintId);

  const snapshotMutation = trpc.sprintChart.takeSnapshot.useMutation({
    onSuccess: () => toast.success("Snapshot saved"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "DKFlow", href: "/home" },
          { label: project?.name || "Project" },
          { label: "Sprints", href: `/${workspaceSlug}/projects/${projectId}/sprints` },
          { label: sprint?.name || "Sprint" },
          { label: "Charts" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/${workspaceSlug}/projects/${projectId}/sprints`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                {sprint?.name || "Sprint"} — Charts
              </h1>
              <p className="text-sm text-muted-foreground">Visual analytics for sprint progress and team velocity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex rounded-lg border bg-muted/30 p-0.5">
              <button
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === "points" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setMode("points")}
              >
                Points
              </button>
              <button
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${mode === "tasks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setMode("tasks")}
              >
                Tasks
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => snapshotMutation.mutate({ sprintId })}
              disabled={snapshotMutation.isPending}
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Snapshot
            </Button>
          </div>
        </div>

        {/* Charts Grid */}
        <Tabs defaultValue="burndown" className="space-y-4">
          <TabsList>
            <TabsTrigger value="burndown" className="gap-1.5"><TrendingDown className="h-3.5 w-3.5" />Burndown</TabsTrigger>
            <TabsTrigger value="burnup" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Burnup</TabsTrigger>
            <TabsTrigger value="velocity" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Velocity</TabsTrigger>
            <TabsTrigger value="flow" className="gap-1.5"><Layers className="h-3.5 w-3.5" />Cumulative Flow</TabsTrigger>
          </TabsList>

          <TabsContent value="burndown">
            <Card className="p-6 bg-background border-border">
              <h3 className="text-lg font-semibold mb-1">Burndown Chart</h3>
              <p className="text-xs text-muted-foreground mb-4">Track remaining work over time — ideally the actual line follows the ideal diagonal down to zero</p>
              <BurndownChart sprintId={sprintId} mode={mode} />
            </Card>
          </TabsContent>

          <TabsContent value="burnup">
            <Card className="p-6 bg-background border-border">
              <h3 className="text-lg font-semibold mb-1">Burnup Chart</h3>
              <p className="text-xs text-muted-foreground mb-4">See completed work vs total scope — watch for scope creep when the yellow line rises</p>
              <BurnupChart sprintId={sprintId} mode={mode} />
            </Card>
          </TabsContent>

          <TabsContent value="velocity">
            <Card className="p-6 bg-background border-border">
              <h3 className="text-lg font-semibold mb-1">Velocity Chart</h3>
              <p className="text-xs text-muted-foreground mb-4">Completed story points per sprint — helps predict future capacity</p>
              <VelocityChart projectId={projectId} />
            </Card>
          </TabsContent>

          <TabsContent value="flow">
            <Card className="p-6 bg-background border-border">
              <h3 className="text-lg font-semibold mb-1">Cumulative Flow Diagram</h3>
              <p className="text-xs text-muted-foreground mb-4">Distribution of tasks across statuses over time — widening bands indicate bottlenecks</p>
              <CumulativeFlowChart sprintId={sprintId} />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
