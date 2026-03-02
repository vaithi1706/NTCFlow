"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles, Loader2, Wand2, AlignLeft, FileEdit, Minimize2, Maximize2,
  SpellCheck, Languages, Check,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiTextCopilotProps {
  text: string;
  fieldType: "title" | "description" | "comment";
  projectId: string;
  onApply: (newText: string) => void;
}

const modes = [
  { key: "improve", label: "Improve Writing", icon: Wand2 },
  { key: "professional", label: "Make Professional", icon: FileEdit },
  { key: "concise", label: "Make Concise", icon: Minimize2 },
  { key: "expand", label: "Add More Detail", icon: Maximize2 },
  { key: "fix_grammar", label: "Fix Grammar", icon: SpellCheck },
] as const;

export function AiTextCopilot({ text, fieldType, projectId, onApply }: AiTextCopilotProps) {
  const [pending, setPending] = useState<string | null>(null);

  const mutation = trpc.ai.enhanceText.useMutation({
    onSuccess: (data) => {
      onApply(data.enhanced);
      toast.success(data.changes || "Text enhanced");
      setPending(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setPending(null);
    },
  });

  const handleEnhance = (mode: string) => {
    if (!text.trim()) {
      toast.error("No text to enhance");
      return;
    }
    setPending(mode);
    mutation.mutate({ text, mode: mode as any, fieldType, projectId });
  };

  if (!text.trim()) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 h-6 px-2 text-xs text-muted-foreground hover:text-primary">
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          AI
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {modes.map(({ key, label, icon: Icon }) => (
          <DropdownMenuItem
            key={key}
            onClick={() => handleEnhance(key)}
            disabled={mutation.isPending}
            className="gap-2"
          >
            {pending === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleEnhance("translate")} disabled={mutation.isPending} className="gap-2">
          <Languages className="h-4 w-4" />
          Translate to English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
