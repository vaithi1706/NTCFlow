"use client";

import { useState, useEffect } from "react";
import {
  Brain, Zap, AlertTriangle, AlertCircle, Info, CheckCircle2,
  Search, MessageSquare, TrendingUp, Users, Target, Loader2,
  ChevronRight, Clock, BarChart3, Sparkles, RefreshCw, Send,
  Eye, X, Lightbulb, ShieldAlert, Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/api/trpc";
import { cn } from "@/lib/utils";

// --- Engine Status Card ---
function EngineStatusCard({ workspaceId }: { workspaceId: string }) {
  const { data: status, isLoading } = trpc.engine.status.useQuery({ workspaceId });
  const initMutation = trpc.engine.initialize.useMutation();

  if (isLoading) {
    return (
      <Card className="p-6 bg-gradient-to-br from-violet-600/5 to-indigo-600/5 border-violet-500/20">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          <span className="text-sm text-muted-foreground">Loading engine status...</span>
        </div>
      </Card>
    );
  }

  const initialized = status?.initialized;

  return (
    <Card className="p-6 bg-gradient-to-br from-violet-600/5 to-indigo-600/5 border-violet-500/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            initialized ? "bg-violet-500/20" : "bg-muted/30"
          )}>
            <Brain className={cn("h-5 w-5", initialized ? "text-violet-400" : "text-muted-foreground")} />
          </div>
          <div>
            <h3 className="font-semibold">Intelligence Engine</h3>
            <p className="text-xs text-muted-foreground">
              {initialized ? "Active — Learning from your project" : "Not initialized — Click to activate"}
            </p>
          </div>
        </div>
        <div className={cn(
          "px-2 py-1 rounded-full text-xs font-medium",
          initialized ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
        )}>
          {initialized ? "● Active" : "○ Inactive"}
        </div>
      </div>

      {initialized ? (
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-violet-400">{status?.totalEmbeddings || 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Memories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{status?.totalPatterns || 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Patterns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-400">{status?.totalInsights || 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Insights</div>
          </div>
        </div>
      ) : (
        <Button
          className="w-full bg-violet-600 hover:bg-violet-700"
          onClick={() => initMutation.mutate({ workspaceId })}
          disabled={initMutation.isPending}
        >
          {initMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Initializing Engine... This may take a few minutes
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Activate Intelligence Engine
            </>
          )}
        </Button>
      )}

      {initialized && status?.lastSync && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Last sync: {new Date(status.lastSync).toLocaleString()}
          </span>
          <Button
            variant="ghost" size="sm" className="h-6 text-xs"
            onClick={() => initMutation.mutate({ workspaceId })}
            disabled={initMutation.isPending}
          >
            <RefreshCw className={cn("h-3 w-3 mr-1", initMutation.isPending && "animate-spin")} />
            Refresh
          </Button>
        </div>
      )}
    </Card>
  );
}

// --- Severity Badge ---
function SeverityBadge({ severity }: { severity: string }) {
  const config = {
    critical: { icon: AlertCircle, color: "bg-red-500/20 text-red-400", label: "Critical" },
    warning: { icon: AlertTriangle, color: "bg-yellow-500/20 text-yellow-400", label: "Warning" },
    info: { icon: Info, color: "bg-blue-500/20 text-blue-400", label: "Info" },
  }[severity] || { icon: Info, color: "bg-muted/30 text-muted-foreground", label: severity };

  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", config.color)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// --- Type Icon ---
function InsightTypeIcon({ type }: { type: string }) {
  const icons: Record<string, typeof Brain> = {
    risk: ShieldAlert,
    pattern: TrendingUp,
    recommendation: Lightbulb,
    anomaly: Activity,
    prediction: Target,
  };
  const Icon = icons[type] || Brain;
  return <Icon className="h-4 w-4" />;
}

// --- Insights Panel ---
function InsightsPanel({ workspaceId }: { workspaceId: string }) {
  const { data: insights, isLoading, refetch } = trpc.engine.insights.useQuery({
    workspaceId,
    limit: 20,
  });
  const markMutation = trpc.engine.markInsight.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          <span className="text-sm text-muted-foreground">Loading insights...</span>
        </div>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card className="p-6 border-dashed">
        <div className="text-center py-8">
          <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-muted-foreground">No insights yet</h3>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Initialize the engine to start generating intelligence
          </p>
        </div>
      </Card>
    );
  }

  const criticalCount = insights.filter(i => i.severity === "critical").length;
  const warningCount = insights.filter(i => i.severity === "warning").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold">Today&apos;s Intelligence</h3>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-400">
              {warningCount} warning
            </span>
          )}
        </div>
      </div>

      {insights.map((insight) => (
        <Card
          key={insight.id}
          className={cn(
            "p-4 transition-all hover:border-violet-500/30",
            insight.severity === "critical" && "border-red-500/30 bg-red-500/5",
            insight.severity === "warning" && "border-yellow-500/20 bg-yellow-500/5",
            insight.isRead && "opacity-70"
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              insight.severity === "critical" ? "bg-red-500/20 text-red-400" :
              insight.severity === "warning" ? "bg-yellow-500/20 text-yellow-400" :
              "bg-violet-500/20 text-violet-400"
            )}>
              <InsightTypeIcon type={insight.type} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-medium truncate">{insight.title}</h4>
                <SeverityBadge severity={insight.severity} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>

              {insight.data?.suggestedAction && (
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="outline" size="sm" className="h-6 text-[10px]"
                    onClick={() => markMutation.mutate({ insightId: insight.id, action: "actioned" })}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Take Action
                  </Button>
                  <Button
                    variant="ghost" size="sm" className="h-6 text-[10px]"
                    onClick={() => markMutation.mutate({ insightId: insight.id, action: "dismissed" })}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground shrink-0">
              {new Date(insight.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// --- Ask Engine ---
function AskEngine({ workspaceId, projectId }: { workspaceId: string; projectId?: string }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Array<{ q: string; a: string; sources: any[] }>>([]);
  const askMutation = trpc.engine.ask.useMutation({
    onSuccess: (data) => {
      setHistory(prev => [...prev, { q: question, a: data.answer, sources: data.sources }]);
      setQuestion("");
    },
  });

  return (
    <Card className="p-6 bg-gradient-to-br from-indigo-600/5 to-blue-600/5 border-indigo-500/20">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-4 w-4 text-indigo-400" />
        <h3 className="text-sm font-semibold">Ask Engine</h3>
        <span className="text-[10px] text-muted-foreground">— Ask anything about your project</span>
      </div>

      {history.length > 0 && (
        <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
          {history.map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Users className="h-3 w-3 text-blue-400" />
                </div>
                <p className="text-sm">{item.q}</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                  <Brain className="h-3 w-3 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.a}</p>
                  {item.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.sources.map((s, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-muted/50 text-muted-foreground">
                          {s.type} ({Math.round(s.similarity * 100)}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim() || askMutation.isPending) return;
          askMutation.mutate({ workspaceId, question, projectId });
        }}
        className="flex gap-2"
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Why is the auth module delayed? Who's best at React tasks?"
          className="flex-1 text-sm bg-background/50"
          disabled={askMutation.isPending}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!question.trim() || askMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {askMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Card>
  );
}

// --- Patterns Panel ---
function PatternsPanel({ workspaceId }: { workspaceId: string }) {
  const { data: patterns, isLoading } = trpc.engine.patterns.useQuery({ workspaceId });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm text-muted-foreground">Analyzing patterns...</span>
        </div>
      </Card>
    );
  }

  if (!patterns || patterns.length === 0) {
    return (
      <Card className="p-6 border-dashed">
        <div className="text-center py-6">
          <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <h3 className="text-sm font-medium text-muted-foreground">No patterns detected yet</h3>
          <p className="text-xs text-muted-foreground/70 mt-1">The engine needs more data to find patterns</p>
        </div>
      </Card>
    );
  }

  const patternConfig: Record<string, { icon: typeof Brain; label: string; color: string }> = {
    estimation_accuracy: { icon: Target, label: "Estimation Accuracy", color: "text-blue-400" },
    member_strength: { icon: Users, label: "Team Strengths", color: "text-green-400" },
    team_velocity: { icon: TrendingUp, label: "Velocity Trends", color: "text-violet-400" },
    blocker_signal: { icon: AlertTriangle, label: "Blocker Signals", color: "text-red-400" },
  };

  // Group by type
  const grouped = patterns.reduce((acc, p) => {
    if (!acc[p.patternType]) acc[p.patternType] = [];
    acc[p.patternType]!.push(p);
    return acc;
  }, {} as Record<string, typeof patterns>);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-400" />
        <h3 className="text-sm font-semibold">Learned Patterns</h3>
        <span className="text-[10px] text-muted-foreground">({patterns.length} found)</span>
      </div>

      {Object.entries(grouped).map(([type, typePatterns]) => {
        const config = patternConfig[type] || { icon: Brain, label: type, color: "text-muted-foreground" };
        const Icon = config.icon;

        return (
          <Card key={type} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={cn("h-4 w-4", config.color)} />
              <h4 className="text-xs font-semibold uppercase tracking-wider">{config.label}</h4>
              <span className="text-[10px] text-muted-foreground">({typePatterns.length})</span>
            </div>
            <div className="space-y-2">
              {typePatterns.slice(0, 5).map((pattern, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    <span>
                      {pattern.patternData.memberName || pattern.patternData.projectName || pattern.patternData.taskTitle || "Pattern"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {pattern.patternData.tendency && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px]",
                        pattern.patternData.tendency === "accurate" ? "bg-green-500/20 text-green-400" :
                        pattern.patternData.tendency === "underestimates" ? "bg-red-500/20 text-red-400" :
                        "bg-blue-500/20 text-blue-400"
                      )}>
                        {pattern.patternData.tendency}
                      </span>
                    )}
                    {pattern.patternData.trend && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px]",
                        pattern.patternData.trend === "improving" ? "bg-green-500/20 text-green-400" :
                        pattern.patternData.trend === "declining" ? "bg-red-500/20 text-red-400" :
                        "bg-muted/50 text-muted-foreground"
                      )}>
                        {pattern.patternData.trend}
                      </span>
                    )}
                    {pattern.patternData.severity && (
                      <SeverityBadge severity={pattern.patternData.severity} />
                    )}
                    <span className="text-muted-foreground">
                      {Math.round(pattern.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// --- Semantic Search ---
function SemanticSearchPanel({ workspaceId, projectId }: { workspaceId: string; projectId?: string }) {
  const [query, setQuery] = useState("");
  const searchMutation = trpc.engine.search.useMutation();

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold">Semantic Search</h3>
        <span className="text-[10px] text-muted-foreground">— Find anything by meaning, not keywords</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!query.trim() || searchMutation.isPending) return;
          searchMutation.mutate({ workspaceId, query, projectId, limit: 10 });
        }}
        className="flex gap-2 mb-3"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. authentication issues, payment module bugs, deployment problems"
          className="flex-1 text-sm bg-background/50"
        />
        <Button type="submit" size="sm" disabled={!query.trim() || searchMutation.isPending}>
          {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </form>

      {searchMutation.data?.results && searchMutation.data.results.length > 0 && (
        <div className="space-y-2">
          {searchMutation.data.results.map((result, idx) => (
            <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 mt-0.5",
                result.entityType === "task" ? "bg-blue-500/20 text-blue-400" :
                result.entityType === "comment" ? "bg-green-500/20 text-green-400" :
                result.entityType === "activity" ? "bg-orange-500/20 text-orange-400" :
                "bg-violet-500/20 text-violet-400"
              )}>
                {result.entityType}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{result.content}</p>
                <span className="text-[10px] text-muted-foreground">{Math.round(result.similarity * 100)}% match</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {searchMutation.data?.results?.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No results found</p>
      )}
    </Card>
  );
}

// --- Main Engine Dashboard ---
export function EngineDashboard({ workspaceId, projectId }: { workspaceId: string; projectId?: string }) {
  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Intelligence Engine</h1>
          <p className="text-xs text-muted-foreground">AI-powered project intelligence — learns, detects, and advises</p>
        </div>
      </div>

      {/* Status */}
      <EngineStatusCard workspaceId={workspaceId} />

      {/* Ask Engine */}
      <AskEngine workspaceId={workspaceId} projectId={projectId} />

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Insights */}
        <div>
          <InsightsPanel workspaceId={workspaceId} />
        </div>

        {/* Right: Patterns */}
        <div>
          <PatternsPanel workspaceId={workspaceId} />
        </div>
      </div>

      {/* Semantic Search */}
      <SemanticSearchPanel workspaceId={workspaceId} projectId={projectId} />
    </div>
  );
}
