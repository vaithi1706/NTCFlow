"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Video, RefreshCw, Link2, Unlink, Brain, ListTodo,
  ChevronDown, ChevronRight, Clock, Users, CheckCircle2,
  AlertCircle, FileText, Loader2, Plus, Upload, X,
} from "lucide-react";

const API_BASE = "/api/meetings";

function getToken() {
  return localStorage.getItem("accessToken") || "";
}

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  synced: { label: "Ready", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400" },
  processed: { label: "Processed", color: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" },
  tasks_created: { label: "Tasks Created", color: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400" },
  no_transcript: { label: "No Transcript", color: "bg-amber-100 text-amber-700 dark:bg-yellow-500/20 dark:text-yellow-400" },
  empty_transcript: { label: "Empty", color: "bg-amber-100 text-amber-700 dark:bg-yellow-500/20 dark:text-yellow-400" },
};

export default function MeetingsPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [msEmail, setMsEmail] = useState("");
  const [meetings, setMeetings] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [creatingTasks, setCreatingTasks] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ subject: "", transcript: "", attendees: "" });
  const [uploadingTranscript, setUploadingTranscript] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState("");

  const loadMeetings = useCallback(async () => {
    try {
      const data = await api("/list");
      setMeetings(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const data = await api("/status");
      setConnected(data.connected);
      setMsEmail(data.email || "");
      if (data.connected) loadMeetings();
    } catch {
      setConnected(false);
    }
    setLoading(false);
  }, [loadMeetings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ms_connected") === "true") window.history.replaceState({}, "", "/meetings");
    if (params.get("ms_error")) {
      setError(params.get("ms_error") || "Connection failed");
      window.history.replaceState({}, "", "/meetings");
    }
    checkStatus();
    loadMeetings();
  }, [checkStatus, loadMeetings]);

  const connectMicrosoft = async () => {
    try { const data = await api("/connect"); window.location.href = data.authUrl; }
    catch (e: any) { setError(e.message); }
  };

  const disconnectMicrosoft = async () => {
    if (!confirm("Disconnect Microsoft Teams?")) return;
    try { await api("/disconnect", { method: "POST" }); setConnected(false); setMsEmail(""); }
    catch (e: any) { setError(e.message); }
  };

  const syncMeetings = async () => {
    setSyncing(true); setError("");
    try { await api("/sync", { method: "POST", body: JSON.stringify({}) }); await loadMeetings(); }
    catch (e: any) { setError(e.message); }
    setSyncing(false);
  };

  const processMeeting = async (meetingId: string) => {
    setProcessing(meetingId); setError("");
    try { await api(`/${meetingId}/process`, { method: "POST", body: JSON.stringify({}) }); await loadMeetings(); }
    catch (e: any) { setError(e.message); }
    setProcessing(null);
  };

  const createTasks = async (meetingId: string) => {
    setCreatingTasks(meetingId); setError("");
    try {
      const projectId = prompt("Enter Project ID to create tasks in:");
      const workspaceId = prompt("Enter Workspace ID:");
      if (!projectId || !workspaceId) { setCreatingTasks(null); return; }
      const data = await api(`/${meetingId}/create-tasks`, { method: "POST", body: JSON.stringify({ projectId, workspaceId }) });
      alert(`✅ ${data.count} tasks created!`);
      await loadMeetings();
    } catch (e: any) { setError(e.message); }
    setCreatingTasks(null);
  };

  const createManualMeeting = async () => {
    if (!manualForm.subject) return;
    setError("");
    try {
      await api("/manual", { method: "POST", body: JSON.stringify(manualForm) });
      setShowManual(false); setManualForm({ subject: "", transcript: "", attendees: "" }); await loadMeetings();
    } catch (e: any) { setError(e.message); }
  };

  const uploadTranscript = async (meetingId: string) => {
    if (!transcriptText || transcriptText.length < 20) return;
    setUploadingTranscript(meetingId);
    try {
      await api(`/${meetingId}/upload-transcript`, { method: "POST", body: JSON.stringify({ transcript: transcriptText }) });
      setTranscriptText(""); setUploadingTranscript(null); await loadMeetings();
    } catch (e: any) { setError(e.message); setUploadingTranscript(null); }
  };

  const deleteMeeting = async (meetingId: string) => {
    if (!confirm("Delete this meeting?")) return;
    try { await api(`/${meetingId}`, { method: "DELETE" }); await loadMeetings(); }
    catch (e: any) { setError(e.message); }
  };

  const formatDate = (d: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <TopBar title="Meetings" />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-500" /> Team Meetings
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Add meetings → paste transcript → AI summarizes → auto-create tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowManual(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Manually
            </Button>
            {connected && (
              <Button size="sm" onClick={syncMeetings} disabled={syncing}>
                {syncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                {syncing ? "Syncing..." : "Sync"}
              </Button>
            )}
          </div>
        </div>

        {/* Connection Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? "bg-green-100 dark:bg-green-500/15" : "bg-muted"}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22 4v6.5l-3-2.5v8l3-2.5V20l-10 2V2l10 2z" fill={connected ? "#10b981" : "#9ca3af"} />
                  <path d="M2 7h10v10H2V7z" fill={connected ? "#10b981" : "#9ca3af"} opacity="0.5" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-sm">Microsoft Teams</p>
                {connected ? (
                  <p className="text-xs text-green-600 dark:text-green-400">Connected — {msEmail}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Connect to auto-sync meeting transcripts</p>
                )}
              </div>
            </div>
            {connected === null ? (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            ) : connected ? (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={disconnectMicrosoft}>
                <Unlink className="w-4 h-4 mr-1" /> Disconnect
              </Button>
            ) : (
              <Button size="sm" onClick={connectMicrosoft}>
                <Link2 className="w-4 h-4 mr-1" /> Connect Teams
              </Button>
            )}
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            <button onClick={() => setError("")} className="ml-auto text-destructive/60 hover:text-destructive">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && meetings.length === 0 && (
          <Card className="p-12 text-center">
            <Video className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-semibold mb-1">No meetings yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Add a meeting and paste the transcript. AI will summarize it and extract action items as tasks.
            </p>
            <Button size="sm" onClick={() => setShowManual(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Your First Meeting
            </Button>
          </Card>
        )}

        {/* Meetings List */}
        {!loading && meetings.length > 0 && (
          <div className="space-y-2">
            {meetings.map((m) => {
              const isExpanded = expanded === m.id;
              const sc = statusConfig[m.status] || statusConfig.pending;
              const actionItems = typeof m.action_items === "string" ? JSON.parse(m.action_items || "[]") : m.action_items || [];
              const tasksCreated = typeof m.tasks_created === "string" ? JSON.parse(m.tasks_created || "[]") : m.tasks_created || [];

              return (
                <Card key={m.id} className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition"
                    onClick={() => setExpanded(isExpanded ? null : m.id)}
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.subject || "Untitled Meeting"}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDate(m.start_time || m.created_at)}</span>
                        {m.organizer && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {m.organizer}</span>}
                        {m.attendees?.length > 0 && <span>{m.attendees.length} attendees</span>}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.color}`}>{sc.label}</span>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4">
                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {(m.status === "synced" || m.status === "no_transcript") && m.transcript && (
                          <Button size="sm" variant="outline" onClick={() => processMeeting(m.id)} disabled={processing === m.id}>
                            {processing === m.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Brain className="w-3.5 h-3.5 mr-1" />}
                            {processing === m.id ? "Processing..." : "AI Process"}
                          </Button>
                        )}
                        {m.status === "processed" && actionItems.length > 0 && (
                          <Button size="sm" onClick={() => createTasks(m.id)} disabled={creatingTasks === m.id} className="bg-green-600 hover:bg-green-700">
                            {creatingTasks === m.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ListTodo className="w-3.5 h-3.5 mr-1" />}
                            {creatingTasks === m.id ? "Creating..." : `Create ${actionItems.length} Tasks`}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto" onClick={() => deleteMeeting(m.id)}>
                          <X className="w-3.5 h-3.5 mr-1" /> Delete
                        </Button>
                      </div>

                      {/* Transcript upload */}
                      {!m.summary && (
                        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {m.transcript ? "Transcript saved — click AI Process above" : "Paste meeting transcript / notes:"}
                          </p>
                          {!m.transcript && (
                            <>
                              <Textarea
                                className="text-sm h-28 resize-none"
                                placeholder="Paste your meeting transcript, notes, or discussion summary here..."
                                value={uploadingTranscript === m.id ? transcriptText : ""}
                                onChange={(e) => { setUploadingTranscript(m.id); setTranscriptText(e.target.value); }}
                              />
                              <Button size="sm" variant="outline" onClick={() => uploadTranscript(m.id)} disabled={!transcriptText || transcriptText.length < 20}>
                                <Upload className="w-3.5 h-3.5 mr-1" /> Save Transcript
                              </Button>
                            </>
                          )}
                        </div>
                      )}

                      {/* AI Summary */}
                      {m.summary && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> AI Summary</p>
                          <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">{m.summary}</div>
                        </div>
                      )}

                      {/* Action Items */}
                      {actionItems.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <ListTodo className="w-3.5 h-3.5" /> Action Items ({actionItems.length})
                          </p>
                          <div className="space-y-2">
                            {actionItems.map((item: any, i: number) => (
                              <div key={i} className="bg-muted/40 border rounded-lg p-3 flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                  {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{item.title}</p>
                                  {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    {item.assignee && item.assignee !== "Unassigned" && (
                                      <Badge variant="secondary" className="text-[10px]">{item.assignee}</Badge>
                                    )}
                                    <Badge variant={item.priority === "URGENT" || item.priority === "HIGH" ? "destructive" : "secondary"} className="text-[10px]">
                                      {item.priority}
                                    </Badge>
                                    {item.dueDate && <span className="text-[10px] text-muted-foreground">{new Date(item.dueDate).toLocaleDateString("en-IN")}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tasks Created */}
                      {tasksCreated.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Tasks Created ({tasksCreated.length})
                          </p>
                          <div className="space-y-1">
                            {tasksCreated.map((t: any, i: number) => (
                              <div key={i} className="bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/10 rounded-lg p-2.5 flex items-center justify-between">
                                <span className="text-sm">{t.title}</span>
                                <span className="text-xs text-muted-foreground">{t.assignee}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Attendees */}
                      {m.attendees?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Attendees</p>
                          <div className="flex flex-wrap gap-1.5">
                            {m.attendees.map((a: any, i: number) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">{a.name || a.email || a}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Manual Meeting Dialog */}
        {showManual && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">New Meeting</h2>
                <button onClick={() => setShowManual(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Add a meeting and paste the transcript. AI will summarize and extract action items.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Meeting Subject *</label>
                  <Input
                    placeholder="Sprint Planning — Feb 25"
                    value={manualForm.subject}
                    onChange={(e) => setManualForm((f) => ({ ...f, subject: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Attendees</label>
                  <Input
                    placeholder="Lokesh, Raju, Suresh"
                    value={manualForm.attendees}
                    onChange={(e) => setManualForm((f) => ({ ...f, attendees: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Transcript / Notes</label>
                  <Textarea
                    className="h-40 resize-none"
                    placeholder={"Paste meeting transcript or notes...\n\nExample:\nLokesh: We need to finish the dashboard by Friday.\nRaju: I'll handle the API. Done by Wednesday.\nSuresh: Design review pending, scheduling tomorrow."}
                    value={manualForm.transcript}
                    onChange={(e) => setManualForm((f) => ({ ...f, transcript: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setShowManual(false)}>Cancel</Button>
                <Button onClick={createManualMeeting} disabled={!manualForm.subject}>Add Meeting</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
