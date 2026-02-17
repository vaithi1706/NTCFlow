"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, FileText, FolderKanban, MessageSquare, Clock, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { TopBar } from "@/components/layout/topbar";
import { useDebounce } from "@/hooks/use-debounce";

const RECENT_KEY = "dkflow-recent-searches";
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}

function addRecentSearch(q: string) {
  const recent = getRecentSearches().filter((s) => s !== q);
  recent.unshift(q);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export default function SearchPage() {
  const router = useRouter();
  const { workspaceId } = useAuthStore();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    inputRef.current?.focus();
  }, []);

  // Listen for "/" shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as any)?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const { data, isLoading } = trpc.search.global.useQuery(
    { query: debouncedQuery, workspaceId: workspaceId || undefined, limit: 20 },
    { enabled: debouncedQuery.length >= 1 }
  );

  const handleSearch = (q: string) => {
    setQuery(q);
    if (q.trim()) addRecentSearch(q.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      addRecentSearch(query.trim());
      setRecentSearches(getRecentSearches());
    }
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecentSearches([]);
  };

  const tasks = data?.tasks || [];
  const projects = data?.projects || [];
  const comments = data?.comments || [];
  const hasResults = tasks.length > 0 || projects.length > 0 || comments.length > 0;

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: "Search" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-4">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks, projects, comments..."
              className="pl-10 pr-10 h-12 text-lg bg-muted/30 border-muted-foreground/20"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!debouncedQuery && recentSearches.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">Recent searches</h3>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearRecent}>Clear</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSearch(s)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors"
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading && debouncedQuery && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {debouncedQuery && !isLoading && !hasResults && (
            <div className="py-20 text-center">
              <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">No results for &quot;{debouncedQuery}&quot;</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Try different keywords</p>
            </div>
          )}

          {tasks.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold">Tasks</h3>
                <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
              </div>
              <div className="space-y-1">
                {tasks.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => router.push(`/workspace/projects/${t.projectId}/board?task=${t.id}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          {t.project?.taskPrefix}-{t.taskNumber}
                        </span>
                        <span className="text-sm truncate">{t.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.project?.name}</p>
                    </div>
                    {t.priority && t.priority !== "none" && (
                      <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {projects.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <FolderKanban className="h-4 w-4 text-green-400" />
                <h3 className="text-sm font-semibold">Projects</h3>
                <Badge variant="secondary" className="text-[10px]">{projects.length}</Badge>
              </div>
              <div className="space-y-1">
                {projects.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => router.push(`/workspace/projects/${p.id}/board`)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color || "#94A3B8" }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{p.name}</span>
                      {p.description && (
                        <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {comments.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold">Comments</h3>
                <Badge variant="secondary" className="text-[10px]">{comments.length}</Badge>
              </div>
              <div className="space-y-1">
                {comments.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/workspace/projects/board?task=${c.taskId}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-1">{c.content}</p>
                      <p className="text-xs text-muted-foreground">
                        on {c.task?.project?.taskPrefix}-{c.task?.taskNumber} · {c.task?.title}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
