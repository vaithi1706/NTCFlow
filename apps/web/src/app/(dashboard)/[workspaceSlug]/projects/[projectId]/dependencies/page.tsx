"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/api/trpc";
import { GitBranch } from "lucide-react";

const STATUS_COLORS: Record<string, { fill: string; stroke: string }> = {
  done: { fill: "#22c55e", stroke: "#16a34a" },
  in_progress: { fill: "#3b82f6", stroke: "#2563eb" },
  in_review: { fill: "#8b5cf6", stroke: "#7c3aed" },
  todo: { fill: "#64748b", stroke: "#475569" },
  backlog: { fill: "#475569", stroke: "#334155" },
  cancelled: { fill: "#6b7280", stroke: "#4b5563" },
};

interface NodePos {
  id: string;
  x: number;
  y: number;
  task: any;
  level: number;
  blocked: boolean;
  onCriticalPath: boolean;
}

interface DepEdge {
  fromId: string;
  toId: string;
}

export default function DependenciesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const svgRef = useRef<SVGSVGElement>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [allDeps, setAllDeps] = useState<DepEdge[]>([]);
  const [depsLoading, setDepsLoading] = useState(true);

  const { data: project } = trpc.project.getById.useQuery({ id: projectId }, { enabled: !!projectId });
  const { data: taskData, isLoading } = trpc.task.list.useQuery(
    { projectId, limit: 200 },
    { enabled: !!projectId }
  );

  const tasks = taskData?.tasks ?? [];
  const utils = trpc.useUtils();

  // Fetch all dependencies in a useEffect instead of conditional hooks
  useEffect(() => {
    if (!tasks.length) {
      setDepsLoading(false);
      setAllDeps([]);
      return;
    }

    let cancelled = false;
    setDepsLoading(true);

    const fetchAllDeps = async () => {
      const projectTaskIds = new Set(tasks.map((t: any) => t.id));
      const edges: DepEdge[] = [];
      const seen = new Set<string>();

      // Fetch deps for each task (max 50)
      const batchTasks = tasks.slice(0, 50);
      const results = await Promise.allSettled(
        batchTasks.map((t: any) =>
          utils.task.getDependencies.fetch({ taskId: t.id })
        )
      );

      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value) continue;
        const { dependencies, dependents } = result.value;

        for (const dep of (dependencies ?? [])) {
          if (!dep.dependsOn || !projectTaskIds.has(dep.dependsOn.id)) continue;
          const key = `${dep.dependsOn.id}->${dep.taskId}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ fromId: dep.dependsOn.id, toId: dep.taskId });
          }
        }

        for (const dep of (dependents ?? [])) {
          if (!dep.task || !projectTaskIds.has(dep.task.id)) continue;
          const key = `${dep.dependsOnId}->${dep.task.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ fromId: dep.dependsOnId, toId: dep.task.id });
          }
        }
      }

      if (!cancelled) {
        setAllDeps(edges);
        setDepsLoading(false);
      }
    };

    fetchAllDeps();
    return () => { cancelled = true; };
  }, [tasks.length, projectId]);

  const { nodes, edges, svgWidth, svgHeight, hasDeps } = useMemo(() => {
    if (!tasks.length || depsLoading) return { nodes: [], edges: [], svgWidth: 800, svgHeight: 400, hasDeps: false };

    const taskMap = new Map(tasks.map((t: any) => [t.id, t]));
    const blockedSet = new Set<string>();

    // Build adjacency
    const adjForward = new Map<string, string[]>();
    const adjBack = new Map<string, string[]>();

    for (const edge of allDeps) {
      if (!adjForward.has(edge.fromId)) adjForward.set(edge.fromId, []);
      adjForward.get(edge.fromId)!.push(edge.toId);
      if (!adjBack.has(edge.toId)) adjBack.set(edge.toId, []);
      adjBack.get(edge.toId)!.push(edge.fromId);

      const blocker = taskMap.get(edge.fromId);
      if (blocker && blocker.status !== "done") blockedSet.add(edge.toId);
    }

    // Involved tasks
    const involvedIds = new Set<string>();
    for (const [k, vs] of adjForward) { involvedIds.add(k); vs.forEach((v) => involvedIds.add(v)); }
    for (const [k, vs] of adjBack) { involvedIds.add(k); vs.forEach((v) => involvedIds.add(v)); }

    let involved = tasks.filter((t: any) => involvedIds.has(t.id));
    if (filterStatus !== "all") involved = involved.filter((t: any) => t.status === filterStatus);
    const filteredIds = new Set(involved.map((t: any) => t.id));

    // Topological levels
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    function calcLevel(id: string): number {
      if (levels.has(id)) return levels.get(id)!;
      if (visited.has(id)) return 0;
      visited.add(id);
      const parents = (adjBack.get(id) || []).filter((pid) => filteredIds.has(pid));
      const maxParent = parents.reduce((max, pid) => Math.max(max, calcLevel(pid)), -1);
      const level = maxParent + 1;
      levels.set(id, level);
      return level;
    }

    for (const t of involved) calcLevel(t.id);

    // Critical path
    const criticalPath = new Set<string>();
    let maxLevel = 0;
    for (const [, level] of levels) if (level > maxLevel) maxLevel = level;

    function traceCritical(id: string) {
      criticalPath.add(id);
      const parents = (adjBack.get(id) || []).filter((pid) => filteredIds.has(pid));
      const best = parents.reduce<{ id: string; level: number } | null>((b, pid) => {
        const pl = levels.get(pid) ?? 0;
        return !b || pl > b.level ? { id: pid, level: pl } : b;
      }, null);
      if (best) traceCritical(best.id);
    }
    for (const [id, level] of levels) {
      if (level === maxLevel) traceCritical(id);
    }

    // Layout
    const nodeWidth = 180;
    const nodeHeight = 50;
    const xGap = 60;
    const yGap = 30;
    const padding = 40;

    const byLevel = new Map<number, any[]>();
    for (const t of involved) {
      const level = levels.get(t.id) ?? 0;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)!.push(t);
    }

    const nodePositions: NodePos[] = [];
    let maxX = 0;
    let maxY = 0;

    for (const [level, levelTasks] of byLevel) {
      const x = padding + level * (nodeWidth + xGap);
      levelTasks.forEach((t: any, i: number) => {
        const y = padding + i * (nodeHeight + yGap);
        nodePositions.push({
          id: t.id, x, y, task: t, level,
          blocked: blockedSet.has(t.id),
          onCriticalPath: criticalPath.has(t.id),
        });
        if (x + nodeWidth > maxX) maxX = x + nodeWidth;
        if (y + nodeHeight > maxY) maxY = y + nodeHeight;
      });
    }

    const nodeMap = new Map(nodePositions.map((n) => [n.id, n]));
    const edgeList: { from: NodePos; to: NodePos; critical: boolean }[] = [];
    for (const [fromId, toIds] of adjForward) {
      const fromNode = nodeMap.get(fromId);
      if (!fromNode) continue;
      for (const toId of toIds) {
        const toNode = nodeMap.get(toId);
        if (!toNode) continue;
        edgeList.push({ from: fromNode, to: toNode, critical: criticalPath.has(fromId) && criticalPath.has(toId) });
      }
    }

    return {
      nodes: nodePositions,
      edges: edgeList,
      svgWidth: Math.max(maxX + padding, 800),
      svgHeight: Math.max(maxY + padding, 400),
      hasDeps: allDeps.length > 0,
    };
  }, [tasks, allDeps, depsLoading, filterStatus]);

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "DKFlow", href: "/home" },
          { label: project?.name || "Project", href: `/${workspaceSlug}/projects/${projectId}/board` },
          { label: "Dependencies" },
        ]}
        showViewSwitcher
        currentView="dependencies"
        onViewChange={handleViewChange}
        projectId={projectId}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Dependency Graph</h2>
            {nodes.length > 0 && (
              <span className="text-xs text-muted-foreground">{nodes.length} tasks · {edges.length} links</span>
            )}
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-4 mb-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: "#22c55e" }} /> Done</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: "#3b82f6" }} /> In Progress</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: "#64748b" }} /> Todo</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border-2 border-red-500" /> Blocked</span>
          <span className="flex items-center gap-1"><span className="h-3 w-6 border-t-2 border-amber-400" /> Critical Path</span>
        </div>

        {isLoading || depsLoading ? (
          <Skeleton className="h-[400px] w-full rounded-lg" />
        ) : !hasDeps || !nodes.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <GitBranch className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No dependencies found</p>
            <p className="text-sm">Add dependencies between tasks to see the graph</p>
          </div>
        ) : (
          <div className="bg-muted/50 border border-border/50 rounded-lg overflow-auto">
            <svg ref={svgRef} width={svgWidth} height={svgHeight}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                </marker>
                <marker id="arrow-critical" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
                </marker>
              </defs>

              {edges.map((edge, i) => {
                const x1 = edge.from.x + 180;
                const y1 = edge.from.y + 25;
                const x2 = edge.to.x;
                const y2 = edge.to.y + 25;
                const midX = (x1 + x2) / 2;
                return (
                  <path
                    key={i}
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={edge.critical ? "#f59e0b" : "#475569"}
                    strokeWidth={edge.critical ? 2.5 : 1.5}
                    markerEnd={edge.critical ? "url(#arrow-critical)" : "url(#arrow)"}
                    opacity={0.7}
                  />
                );
              })}

              {nodes.map((node) => {
                const colors = STATUS_COLORS[node.task.status] || STATUS_COLORS.todo;
                return (
                  <g key={node.id} transform={`translate(${node.x}, ${node.y})`} className="cursor-pointer">
                    <rect
                      width={180} height={50} rx={8}
                      style={{ fill: "var(--color-card, var(--card))" }}
                      stroke={node.blocked ? "#ef4444" : node.onCriticalPath ? "#f59e0b" : colors.stroke}
                      strokeWidth={node.blocked ? 2.5 : node.onCriticalPath ? 2 : 1}
                    />
                    <rect width={4} height={50} rx={2} fill={colors.fill} />
                    <text x={14} y={20} fontSize={11} style={{ fill: "var(--color-card-foreground, var(--card-foreground))" }} fontWeight={500}>
                      {node.task.title?.slice(0, 22)}{(node.task.title?.length ?? 0) > 22 ? "…" : ""}
                    </text>
                    <text x={14} y={36} fontSize={9} style={{ fill: "var(--color-muted-foreground, var(--muted-foreground))" }}>
                      #{node.task.taskNumber} · {node.task.status?.replace("_", " ")}
                    </text>
                    {node.blocked && (
                      <text x={165} y={18} fontSize={10} fill="#ef4444" textAnchor="end">⛔</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </>
  );
}
