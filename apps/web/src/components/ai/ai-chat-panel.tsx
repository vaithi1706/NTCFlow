"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Bot, Send, X, Sparkles, CheckCircle2, XCircle, Loader2,
  Plus, Trash2, PanelLeftClose, PanelLeftOpen, Pencil, Check,
  ArrowRight, UserPlus, AlertTriangle, MessageSquare, Cpu,
  ClipboardList, Users, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/api/trpc";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ type: string; description: string; success: boolean }>;
  createdAt?: string;
}

interface ChatSession {
  id: string;
  title: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
}

const QUICK_ACTIONS = [
  { label: "Create task", icon: Plus },
  { label: "Sprint status", icon: Zap },
  { label: "Overdue tasks", icon: AlertTriangle },
  { label: "Team workload", icon: Users },
];

const SUGGESTIONS = [
  { emoji: "📋", label: "What's the project status?" },
  { emoji: "➕", label: "Create a new task" },
  { emoji: "👥", label: "Show team workload" },
  { emoji: "⚠️", label: "What's at risk?" },
];

function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case "create_task": return <Plus className="h-3 w-3" />;
    case "move_task": return <ArrowRight className="h-3 w-3" />;
    case "assign_task": return <UserPlus className="h-3 w-3" />;
    case "comment": return <MessageSquare className="h-3 w-3" />;
    default: return <Zap className="h-3 w-3" />;
  }
}

function groupSessionsByDate(sessions: ChatSession[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; sessions: ChatSession[] }[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Previous 7 days", sessions: [] },
    { label: "Older", sessions: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    if (d >= today) groups[0]!.sessions.push(s);
    else if (d >= yesterday) groups[1]!.sessions.push(s);
    else if (d >= weekAgo) groups[2]!.sessions.push(s);
    else groups[3]!.sessions.push(s);
  }

  return groups.filter(g => g.sessions.length > 0);
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-2 max-w-[85%]">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="h-3.5 w-3.5 text-foreground" />
        </div>
        <div className="bg-muted/80 border border-border rounded-xl rounded-bl-sm px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-base font-bold mb-1 mt-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold mb-1 mt-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-1.5">{children}</h3>,
        p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <pre className="bg-muted border border-border rounded-lg p-3 my-2 overflow-x-auto">
                <code className="text-xs text-emerald-400 font-mono">{children}</code>
              </pre>
            );
          }
          return <code className="bg-muted px-1.5 py-0.5 rounded text-xs text-emerald-400 font-mono">{children}</code>;
        },
        pre: ({ children }) => <>{children}</>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-violet-500 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function AiChatPanel({ projectId, workspaceId }: { projectId?: string; workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [sessionTitle, setSessionTitle] = useState("New Chat");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  const sessionsQuery = trpc.ai.chatSessions.useQuery(
    { workspaceId },
    { enabled: open, refetchOnWindowFocus: false }
  );

  const historyQuery = trpc.ai.chatHistory.useQuery(
    { sessionId: activeSessionId! },
    {
      enabled: !!activeSessionId && open,
      refetchOnWindowFocus: false,
      onSuccess: (data) => {
        setSessionTitle(data.session.title);
        setMessages(data.messages.map(m => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          actions: m.actions as any,
          createdAt: m.createdAt,
        })));
      },
    }
  );

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        actions: data.actionsExecuted,
      }]);
      if (data.sessionId && !activeSessionId) {
        setActiveSessionId(data.sessionId);
      }
      // Refresh sessions list after a short delay (for auto-title)
      setTimeout(() => utils.ai.chatSessions.invalidate(), 2000);
    },
    onError: (err) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Sorry, I encountered an error: ${err.message}`,
      }]);
    },
  });

  const deleteMutation = trpc.ai.deleteSession.useMutation({
    onSuccess: () => {
      utils.ai.chatSessions.invalidate();
      if (activeSessionId) {
        setActiveSessionId(null);
        setMessages([]);
        setSessionTitle("New Chat");
      }
    },
  });

  const renameMutation = trpc.ai.renameSession.useMutation({
    onSuccess: () => {
      setEditingTitle(false);
      utils.ai.chatSessions.invalidate();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  useEffect(() => {
    if (open && textareaRef.current) textareaRef.current.focus();
  }, [open]);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }, []);

  const handleSend = useCallback((text?: string) => {
    const msg = (text || input).trim();
    if (!msg || chatMutation.isPending) return;
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    chatMutation.mutate({ message: msg, projectId, workspaceId, sessionId: activeSessionId || undefined });
  }, [input, chatMutation.isPending, projectId, workspaceId, activeSessionId]);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setMessages([]);
    setSessionTitle("New Chat");
    setEditingTitle(false);
  }, []);

  const handleSelectSession = useCallback((session: ChatSession) => {
    setActiveSessionId(session.id);
    setEditingTitle(false);
  }, []);

  const handleRename = useCallback(() => {
    if (!activeSessionId || !titleInput.trim()) return;
    setSessionTitle(titleInput.trim());
    renameMutation.mutate({ sessionId: activeSessionId, title: titleInput.trim() });
  }, [activeSessionId, titleInput]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const sessionGroups = useMemo(() => groupSessionsByDate(sessionsQuery.data || []), [sessionsQuery.data]);

  return (
    <>
      {!open && (
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-violet-400 relative"
          onClick={() => setOpen(true)}
          title="AI Assistant"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      )}

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity" onClick={handleClose} />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[520px] max-w-full bg-background border-l border-border z-50 flex shadow-2xl shadow-black/50 animate-in slide-in-from-right duration-300">

            {/* Sidebar */}
            {sidebarOpen && (
              <div className="w-[180px] bg-muted border-r border-border flex flex-col flex-shrink-0">
                <div className="p-2">
                  <button
                    onClick={handleNewChat}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Chat
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-1.5 pb-2 scrollbar-thin scrollbar-thumb-border">
                  {sessionGroups.map(group => (
                    <div key={group.label} className="mb-2">
                      <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </div>
                      {group.sessions.map(session => (
                        <button
                          key={session.id}
                          onClick={() => handleSelectSession(session)}
                          className={cn(
                            "group w-full flex items-center justify-between px-2 py-1.5 text-left text-xs rounded-md transition-colors",
                            activeSessionId === session.id
                              ? "bg-violet-600/20 text-violet-300"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <span className="truncate flex-1">{session.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate({ sessionId: session.id }); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-opacity flex-shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </button>
                      ))}
                    </div>
                  ))}
                  {sessionsQuery.isLoading && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-background">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  >
                    {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                  </button>

                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-3.5 w-3.5 text-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {editingTitle && activeSessionId ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={titleInput}
                          onChange={e => setTitleInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditingTitle(false); }}
                          className="bg-muted border border-border rounded px-2 py-0.5 text-xs text-foreground w-full focus:outline-none focus:border-violet-500"
                          autoFocus
                        />
                        <button onClick={handleRename} className="p-0.5 text-emerald-400 hover:text-emerald-300">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { if (activeSessionId) { setEditingTitle(true); setTitleInput(sessionTitle); } }}
                        className="text-sm font-medium text-foreground truncate block hover:text-violet-300 transition-colors"
                        title={activeSessionId ? "Click to rename" : undefined}
                      >
                        {sessionTitle}
                      </button>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Cpu className="h-2.5 w-2.5" /> Llama 3.3 70B
                      </span>
                    </div>
                  </div>
                </div>

                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0" onClick={handleClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-border">
                {messages.length === 0 && !historyQuery.isLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-6 px-4">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/10 flex items-center justify-center">
                      <Bot className="h-10 w-10 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">Hi! I&apos;m your AI Project Manager</h3>
                      <p className="text-sm text-muted-foreground">I can help you manage tasks, analyze sprints, and more</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full max-w-[320px]">
                      {SUGGESTIONS.map(s => (
                        <button
                          key={s.label}
                          onClick={() => handleSend(s.label)}
                          className="text-left text-xs px-3 py-3 rounded-xl border border-border hover:border-violet-500/30 hover:bg-violet-500/5 transition-all text-muted-foreground hover:text-foreground group"
                        >
                          <span className="text-base mb-1 block">{s.emoji}</span>
                          <span className="group-hover:text-violet-300 transition-colors">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {historyQuery.isLoading && activeSessionId && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={msg.id || i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")} style={{ animation: "fadeIn 0.3s ease-out" }}>
                    {msg.role === "assistant" ? (
                      <div className="flex items-start gap-2 max-w-[88%]">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-foreground" />
                        </div>
                        <div>
                          <div className="bg-muted/80 border border-border rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm text-foreground">
                            <MarkdownContent content={msg.content} />
                          </div>
                          {msg.actions && msg.actions.length > 0 && (
                            <div className="mt-1.5 space-y-1">
                              {msg.actions.map((action, j) => (
                                <div
                                  key={j}
                                  className={cn(
                                    "flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border",
                                    action.success
                                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                      : "bg-red-500/10 border-red-500/20 text-red-400"
                                  )}
                                >
                                  <ActionIcon type={action.type} />
                                  {action.success ? <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> : <XCircle className="h-3 w-3 flex-shrink-0" />}
                                  <span>{action.description}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[85%]">
                        <div className="bg-blue-600 text-foreground rounded-xl rounded-br-sm px-3.5 py-2.5 text-sm">
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {chatMutation.isPending && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions */}
              {messages.length > 0 && (
                <div className="px-3 pt-2 flex gap-1.5 flex-wrap">
                  {QUICK_ACTIONS.map(a => (
                    <button
                      key={a.label}
                      onClick={() => handleSend(a.label)}
                      disabled={chatMutation.isPending}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-violet-300 hover:border-violet-500/30 transition-colors disabled:opacity-50"
                    >
                      <a.icon className="h-2.5 w-2.5" />
                      {a.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleTextareaChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask me anything..."
                    rows={1}
                    className="flex-1 bg-muted border border-border focus:border-violet-500/50 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/25 transition-colors"
                    disabled={chatMutation.isPending}
                    style={{ maxHeight: 120 }}
                  />
                  <Button
                    size="icon"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || chatMutation.isPending}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 flex-shrink-0 h-10 w-10 rounded-xl disabled:opacity-30"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Shift+Enter for new line</p>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgb(51 65 85); border-radius: 2px; }
        .scrollbar-thumb-border::-webkit-scrollbar-thumb { background: rgb(51 65 85); }
        .scrollbar-thumb-border::-webkit-scrollbar-thumb { background: hsl(var(--border)); }
      `}</style>
    </>
  );
}
