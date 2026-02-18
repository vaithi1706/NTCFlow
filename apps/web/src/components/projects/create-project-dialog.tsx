"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Layers, Globe, Smartphone, Rocket, Zap, Target, Briefcase, Code, Loader2, ArrowLeft, FileCode, Megaphone, Bug, PackageOpen } from "lucide-react";

const presetColors = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#06B6D4", "#6366F1",
];

const iconOptions = [
  { value: "Layers", icon: Layers },
  { value: "Globe", icon: Globe },
  { value: "Smartphone", icon: Smartphone },
  { value: "Rocket", icon: Rocket },
  { value: "Zap", icon: Zap },
  { value: "Target", icon: Target },
  { value: "Briefcase", icon: Briefcase },
  { value: "Code", icon: Code },
];

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof FileCode;
  color: string;
  columns: string[];
  labels: { name: string; color: string }[];
}

const templates: ProjectTemplate[] = [
  {
    id: "blank",
    name: "Blank Project",
    description: "Start from scratch with default columns",
    icon: Layers,
    color: "#6366F1",
    columns: [],
    labels: [],
  },
  {
    id: "software",
    name: "Software Development",
    description: "Backlog, In Progress, Review, Testing, Done",
    icon: FileCode,
    color: "#3B82F6",
    columns: ["Backlog", "In Progress", "In Review", "Testing", "Done"],
    labels: [
      { name: "Feature", color: "#10B981" },
      { name: "Bug", color: "#EF4444" },
      { name: "Enhancement", color: "#8B5CF6" },
      { name: "Documentation", color: "#06B6D4" },
      { name: "Tech Debt", color: "#F59E0B" },
    ],
  },
  {
    id: "marketing",
    name: "Marketing Campaign",
    description: "Ideas, Planning, In Progress, Review, Published",
    icon: Megaphone,
    color: "#EC4899",
    columns: ["Ideas", "Planning", "In Progress", "Review", "Published"],
    labels: [
      { name: "Social Media", color: "#3B82F6" },
      { name: "Email", color: "#10B981" },
      { name: "Content", color: "#8B5CF6" },
      { name: "Ads", color: "#F59E0B" },
      { name: "Events", color: "#EF4444" },
    ],
  },
  {
    id: "bugtracking",
    name: "Bug Tracking",
    description: "Reported, Triaged, In Progress, Fixed, Verified",
    icon: Bug,
    color: "#EF4444",
    columns: ["Reported", "Triaged", "In Progress", "Fixed", "Verified"],
    labels: [
      { name: "Critical", color: "#EF4444" },
      { name: "Major", color: "#F59E0B" },
      { name: "Minor", color: "#3B82F6" },
      { name: "UI", color: "#8B5CF6" },
      { name: "Backend", color: "#10B981" },
    ],
  },
  {
    id: "launch",
    name: "Product Launch",
    description: "Prep, Development, Testing, Launch, Post-Launch",
    icon: PackageOpen,
    color: "#F59E0B",
    columns: ["Preparation", "Development", "Testing", "Launch Day", "Post-Launch"],
    labels: [
      { name: "Blocker", color: "#EF4444" },
      { name: "Marketing", color: "#EC4899" },
      { name: "Engineering", color: "#3B82F6" },
      { name: "Design", color: "#8B5CF6" },
      { name: "Legal", color: "#6366F1" },
    ],
  },
];

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const router = useRouter();
  const { workspaceId } = useAuthStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(presetColors[0]!);
  const [icon, setIcon] = useState("Layers");
  const [step, setStep] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>(templates[0]!);

  const utils = trpc.useUtils();
  const createMutation = trpc.project.create.useMutation({
    onSuccess: (project) => {
      toast.success("Project created!");
      onOpenChange(false);
      resetForm();
      utils.project.list.invalidate();
      router.push(`/workspace/projects/${project.id}/board`);
    },
    onError: (err) => toast.error(err.message || "Failed to create project"),
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor(presetColors[0]!);
    setIcon("Layers");
    setStep("template");
    setSelectedTemplate(templates[0]!);
  };

  const handleCreate = () => {
    if (!name.trim() || !workspaceId) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      icon,
      workspaceId,
      ...(selectedTemplate.id !== "blank" ? {
        templateColumns: selectedTemplate.columns,
        templateLabels: selectedTemplate.labels,
      } : {}),
    } as any);
  };

  const handleSelectTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setColor(template.color);
    setStep("details");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "template" ? "Choose a Template" : "Create Project"}
          </DialogTitle>
        </DialogHeader>

        {step === "template" ? (
          <div className="grid grid-cols-1 gap-2 py-2 max-h-[400px] overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: t.color + "20" }}>
                  <t.icon className="h-4 w-4" style={{ color: t.color }} />
                </div>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  {t.columns.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {t.columns.map((c) => (
                        <span key={c} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <button
                onClick={() => setStep("template")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Change template ({selectedTemplate.name})
              </button>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Project" autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" className="resize-none" rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {presetColors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={cn(
                        "h-8 w-8 rounded-full transition-all",
                        color === c ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-105"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex gap-2 flex-wrap">
                  {iconOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setIcon(opt.value)}
                      className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                        icon === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <opt.icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!name.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
