"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import { Plus, Copy, ExternalLink, Trash2, Pencil, FileText } from "lucide-react";

const AVAILABLE_FIELDS = [
  { key: "title", label: "Title", required: true },
  { key: "description", label: "Description", required: false },
  { key: "priority", label: "Priority", required: false },
  { key: "type", label: "Type", required: false },
  { key: "email", label: "Email", required: false },
];

export default function FormsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [createOpen, setCreateOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [defaultType, setDefaultType] = useState("bug");
  const [allowedFields, setAllowedFields] = useState<string[]>(["title", "description", "priority", "type", "email"]);

  const utils = trpc.useUtils();
  const { data: forms, isLoading } = trpc.form.list.useQuery({ projectId }, { enabled: !!projectId });

  const createMutation = trpc.form.create.useMutation({
    onSuccess: () => { utils.form.list.invalidate(); setCreateOpen(false); resetForm(); toast.success("Form created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.form.update.useMutation({
    onSuccess: () => { utils.form.list.invalidate(); setEditForm(null); toast.success("Form updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.form.delete.useMutation({
    onSuccess: () => { utils.form.list.invalidate(); setDeleteId(null); toast.success("Form deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.form.update.useMutation({
    onSuccess: () => { utils.form.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setTitle(""); setDescription(""); setDefaultType("bug");
    setAllowedFields(["title", "description", "priority", "type", "email"]);
  }

  function openEdit(form: any) {
    setEditForm(form);
    setTitle(form.title);
    setDescription(form.description || "");
    setDefaultType(form.defaultType || "bug");
    setAllowedFields(Array.isArray(form.allowedFields) ? form.allowedFields : []);
  }

  function toggleField(key: string) {
    setAllowedFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://72.61.173.123";

  if (isLoading) {
    return (
      <>
        <TopBar title="Forms" />
        <div className="p-6 space-y-4">
          {[1,2].map(i => <Skeleton key={i} className="h-24 bg-slate-800" />)}
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Public Forms" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Public Forms</h2>
            <p className="text-sm text-slate-400">Allow external users to submit tasks without logging in</p>
          </div>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="bg-blue-500 hover:bg-blue-600">
            <Plus className="h-4 w-4 mr-2" /> Create Form
          </Button>
        </div>

        {forms && forms.length === 0 && (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-8 text-center text-slate-500">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No forms yet. Create one to allow external submissions.</p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {forms?.map((form) => (
            <Card key={form.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-medium">{form.title}</h3>
                    <Badge variant={form.isActive ? "default" : "secondary"} className={form.isActive ? "bg-emerald-500/10 text-emerald-400" : ""}>
                      {form.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {form.description && <p className="text-sm text-slate-400 mt-1">{form.description}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">
                      {baseUrl}/forms/{form.slug}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${baseUrl}/forms/${form.slug}`); toast.success("URL copied"); }}
                      className="text-slate-400 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a href={`/forms/${form.slug}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: form.id, isActive: checked })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(form)}>
                    <Pencil className="h-4 w-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(form.id)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create / Edit Dialog */}
        <Dialog open={createOpen || !!editForm} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditForm(null); } }}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle>{editForm ? "Edit Form" : "Create Form"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bug Report Form" className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description shown on the form" className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div>
                <Label>Default Task Type</Label>
                <Select value={defaultType} onValueChange={setDefaultType}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Visible Fields</Label>
                <div className="space-y-2">
                  {AVAILABLE_FIELDS.map((f) => (
                    <label key={f.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={allowedFields.includes(f.key)}
                        onChange={() => !f.required && toggleField(f.key)}
                        disabled={f.required}
                        className="rounded border-slate-600"
                      />
                      <span className="text-slate-300">{f.label}</span>
                      {f.required && <span className="text-xs text-slate-500">(required)</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setCreateOpen(false); setEditForm(null); }}>Cancel</Button>
              <Button
                className="bg-blue-500 hover:bg-blue-600"
                disabled={!title.trim()}
                onClick={() => {
                  if (editForm) {
                    updateMutation.mutate({ id: editForm.id, title, description, defaultType, allowedFields });
                  } else {
                    createMutation.mutate({ projectId, title, description, defaultType, allowedFields });
                  }
                }}
              >
                {editForm ? "Save Changes" : "Create Form"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          title="Delete Form"
          description="Are you sure? This cannot be undone."
          onConfirm={() => deleteId && deleteMutation.mutate({ id: deleteId })}
          variant="destructive"
        />
      </div>
    </>
  );
}
