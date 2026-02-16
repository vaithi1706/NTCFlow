"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Filter, X } from "lucide-react";
import { TASK_TYPES, type TaskType } from "@/components/shared/task-type-badge";
import type { Label, User } from "@dkflow/shared";
import type { Priority } from "@dkflow/shared";

export interface Filters {
  priority: Priority[];
  assignee: string[];
  label: string[];
  taskType: TaskType[];
  dueDate: "overdue" | "today" | "this-week" | "no-date" | null;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  labels: Label[];
  members: User[];
}

const priorities: { value: Priority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "#EF4444" },
  { value: "high", label: "High", color: "#F97316" },
  { value: "medium", label: "Medium", color: "#F59E0B" },
  { value: "low", label: "Low", color: "#3B82F6" },
  { value: "none", label: "None", color: "#94A3B8" },
];

const dueDateOptions = [
  { value: "overdue" as const, label: "Overdue" },
  { value: "today" as const, label: "Today" },
  { value: "this-week" as const, label: "This week" },
  { value: "no-date" as const, label: "No date" },
];

const hasFilters = (f: Filters) => f.priority.length > 0 || f.assignee.length > 0 || f.label.length > 0 || f.taskType.length > 0 || f.dueDate !== null;

export function FilterBar({ filters, onChange, labels, members }: FilterBarProps) {
  const active = hasFilters(filters);

  const togglePriority = (p: Priority) => {
    const next = filters.priority.includes(p) ? filters.priority.filter((x) => x !== p) : [...filters.priority, p];
    onChange({ ...filters, priority: next });
  };

  const toggleAssignee = (id: string) => {
    const next = filters.assignee.includes(id) ? filters.assignee.filter((x) => x !== id) : [...filters.assignee, id];
    onChange({ ...filters, assignee: next });
  };

  const toggleLabel = (id: string) => {
    const next = filters.label.includes(id) ? filters.label.filter((x) => x !== id) : [...filters.label, id];
    onChange({ ...filters, label: next });
  };

  const toggleTaskType = (t: TaskType) => {
    const next = filters.taskType.includes(t) ? filters.taskType.filter((x) => x !== t) : [...filters.taskType, t];
    onChange({ ...filters, taskType: next });
  };

  const setDueDate = (v: Filters["dueDate"]) => {
    onChange({ ...filters, dueDate: filters.dueDate === v ? null : v });
  };

  const clearAll = () => onChange({ priority: [], assignee: [], label: [], taskType: [], dueDate: null });

  return (
    <div className="flex items-center gap-2 px-6 py-2 border-b border-border/50 flex-wrap">
      {/* Priority */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            Priority
            {filters.priority.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{filters.priority.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          {priorities.map((p) => (
            <label key={p.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
              <Checkbox checked={filters.priority.includes(p.value)} onCheckedChange={() => togglePriority(p.value)} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.label}
            </label>
          ))}
        </PopoverContent>
      </Popover>

      {/* Assignee */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            Assignee
            {filters.assignee.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{filters.assignee.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
              <Checkbox checked={filters.assignee.includes(m.id)} onCheckedChange={() => toggleAssignee(m.id)} />
              {m.name}
            </label>
          ))}
        </PopoverContent>
      </Popover>

      {/* Label */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            Label
            {filters.label.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{filters.label.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          {labels.map((l) => (
            <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
              <Checkbox checked={filters.label.includes(l.id)} onCheckedChange={() => toggleLabel(l.id)} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name}
            </label>
          ))}
        </PopoverContent>
      </Popover>

      {/* Task Type */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            Type
            {filters.taskType.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">{filters.taskType.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          {TASK_TYPES.map((t) => (
            <label key={t.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
              <Checkbox checked={filters.taskType.includes(t.value)} onCheckedChange={() => toggleTaskType(t.value)} />
              <span>{t.emoji}</span>
              {t.label}
            </label>
          ))}
        </PopoverContent>
      </Popover>

      {/* Due Date */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
            Due Date
            {filters.dueDate && <Badge variant="secondary" className="h-4 px-1 text-[10px]">1</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          {dueDateOptions.map((o) => (
            <button
              key={o.value}
              onClick={() => setDueDate(o.value)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted/50 ${filters.dueDate === o.value ? "bg-muted font-medium" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Active filter chips */}
      {active && (
        <>
          <Separator orientation="vertical" className="h-5 mx-1" />
          {filters.priority.map((p) => (
            <Badge key={p} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => togglePriority(p)}>
              {p} <X className="h-3 w-3" />
            </Badge>
          ))}
          {filters.assignee.map((id) => {
            const m = members.find((u) => u.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => toggleAssignee(id)}>
                {m?.name || id} <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {filters.label.map((id) => {
            const l = labels.find((x) => x.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => toggleLabel(id)}>
                {l?.name || id} <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {filters.taskType.map((t) => {
            const tt = TASK_TYPES.find((x) => x.value === t);
            return (
              <Badge key={t} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => toggleTaskType(t)}>
                {tt?.emoji} {tt?.label || t} <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {filters.dueDate && (
            <Badge variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => setDueDate(filters.dueDate)}>
              {dueDateOptions.find((o) => o.value === filters.dueDate)?.label} <X className="h-3 w-3" />
            </Badge>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>
            Clear all
          </Button>
        </>
      )}
    </div>
  );
}
