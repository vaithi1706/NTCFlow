"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/api/trpc";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export default function PublicFormPage() {
  const params = useParams();
  const slug = params.slug as string;

  const { data: form, isLoading, error } = trpc.form.getPublic.useQuery(
    { slug },
    { enabled: !!slug, retry: false }
  );

  const submitMutation = trpc.form.submitPublic.useMutation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [type, setType] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [taskInfo, setTaskInfo] = useState<{ taskPrefix: string; taskNumber: number } | null>(null);

  const allowed = Array.isArray(form?.allowedFields) ? (form.allowedFields as string[]) : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await submitMutation.mutateAsync({
        slug,
        title,
        description: description || undefined,
        priority: priority as any,
        type: (type || undefined) as any,
        email: email || undefined,
      });
      setSubmitted(true);
      setTaskInfo(result);
    } catch {}
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="bg-slate-900 border-slate-800 max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-white font-medium">Form not found</p>
            <p className="text-sm text-slate-400 mt-1">This form may have been deactivated or removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="bg-slate-900 border-slate-800 max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white">Submitted!</h2>
            <p className="text-slate-400 mt-2">
              Your submission has been received
              {taskInfo && <span> as <strong className="text-white">{taskInfo.taskPrefix}-{taskInfo.taskNumber}</strong></span>}.
            </p>
            <Button
              className="mt-6 bg-blue-500 hover:bg-blue-600"
              onClick={() => { setSubmitted(false); setTitle(""); setDescription(""); setPriority("none"); setType(""); setEmail(""); }}
            >
              Submit Another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="bg-slate-900 border-slate-800 max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            {form.project.color && (
              <div className="w-3 h-3 rounded" style={{ backgroundColor: form.project.color }} />
            )}
            <span className="text-sm text-slate-400">{form.project.name}</span>
          </div>
          <CardTitle className="text-white text-xl">{form.title}</CardTitle>
          {form.description && <CardDescription className="text-slate-400">{form.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-slate-300">Title <span className="text-red-400">*</span></Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Brief summary"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            {allowed.includes("description") && (
              <div>
                <Label className="text-slate-300">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description..."
                  rows={4}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            )}

            {allowed.includes("priority") && (
              <div>
                <Label className="text-slate-300">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {allowed.includes("type") && (
              <div>
                <Label className="text-slate-300">Type</Label>
                <Select value={type || form.defaultType} onValueChange={setType}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {allowed.includes("email") && (
              <div>
                <Label className="text-slate-300">Your Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="for follow-up (optional)"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600"
              disabled={!title.trim() || submitMutation.isPending}
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit
            </Button>

            {submitMutation.error && (
              <p className="text-sm text-red-400 text-center">{submitMutation.error.message}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
