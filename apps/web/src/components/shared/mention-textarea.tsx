"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/api/trpc";
import { cn } from "@/lib/utils";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  projectId: string;
}

export function MentionTextarea({ value, onChange, placeholder, className, projectId }: MentionTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: members } = trpc.comment.getMentionSuggestions.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const filtered = (members || []).filter((m) =>
    m.name?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const pos = e.target.selectionStart;
    const textBefore = newValue.slice(0, pos);
    const atIndex = textBefore.lastIndexOf("@");

    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(textBefore[atIndex - 1]!))) {
      const query = textBefore.slice(atIndex + 1);
      if (!query.includes(" ") && query.length <= 30) {
        setMentionQuery(query);
        setMentionStart(atIndex);
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }
    setShowSuggestions(false);
  }, [onChange]);

  const insertMention = useCallback((member: { id: string; name: string | null }) => {
    const name = member.name || "User";
    const before = value.slice(0, mentionStart);
    const after = value.slice(textareaRef.current?.selectionStart || mentionStart + mentionQuery.length + 1);
    const newValue = `${before}@${name} ${after}`;
    onChange(newValue);
    setShowSuggestions(false);

    // Focus back
    setTimeout(() => {
      const pos = mentionStart + name.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }, [value, mentionStart, mentionQuery, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filtered[selectedIndex]!);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }, [showSuggestions, filtered, selectedIndex, insertMention]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("min-h-[60px] resize-none", className)}
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
          {filtered.map((member, i) => (
            <button
              key={member.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(member); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors",
                i === selectedIndex && "bg-accent"
              )}
            >
              <Avatar className="h-6 w-6 flex-shrink-0">
                {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                  {(member.name || "?").split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate font-medium">{member.name || "Unknown"}</p>
                {member.email && (
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
