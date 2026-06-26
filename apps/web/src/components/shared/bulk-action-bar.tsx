"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import { Trash2, X, ArrowRight, AlertTriangle, Users } from "lucide-react";
import type { BoardColumn } from "@dkflow/shared";
import type { Priority } from "@dkflow/shared";

interface BulkActionBarProps {
  selectedIds: string[];
  columns: BoardColumn[];
  onClear: () => void;
  onDone: () => void;
}

const priorities: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
];

export function BulkActionBar({ selectedIds, columns, onClear, onDone }: BulkActionBarProps) {
  const utils = trpc.useUtils();

  const bulkUpdateMutation = trpc.task.bulkUpdate.useMutation({
    onSuccess: (_, vars) => {
      // Bulk status / priority / due-date changes ripple into dashboard counts.
      utils.stats.invalidate();
      utils.activity.invalidate();
      toast.success(`Updated ${selectedIds.length} tasks`);
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkDeleteMutation = trpc.task.bulkDelete.useMutation({
    onSuccess: () => {
      utils.stats.invalidate();
      utils.activity.invalidate();
      toast.success(`Deleted ${selectedIds.length} tasks`);
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  if (selectedIds.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3"
      >
        <span className="text-sm font-medium whitespace-nowrap">{selectedIds.length} selected</span>

        <Select onValueChange={(val) => bulkUpdateMutation.mutate({ taskIds: selectedIds, priority: val as Priority })}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {priorities.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={(val) => bulkUpdateMutation.mutate({ taskIds: selectedIds, columnId: val })}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Move to..." />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color || "#94A3B8" }} />
                  {col.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="destructive"
          size="sm"
          className="h-8 text-xs"
          onClick={() => bulkDeleteMutation.mutate({ taskIds: selectedIds })}
        >
          <Trash2 className="h-3 w-3 mr-1" />Delete
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
