"use client";

import { useState } from "react";
import { trpc } from "@/lib/api/trpc";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  Layers,
  Plus,
  Check,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORY_COLORS = ["#6366f1", "#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#ec4899", "#06b6d4", "#f97316"];

interface CategoryPickerProps {
  projectId: string;
  currentCategory: any | null;
  onSelect: (categoryId: string | null) => void;
}

function buildTree(categories: any[], parentId: string | null): any[] {
  return categories
    .filter((c) => c.parentId === parentId)
    .sort((a: any, b: any) => a.position - b.position || a.name.localeCompare(b.name));
}

export function CategoryPicker({ projectId, currentCategory, onSelect }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  const utils = trpc.useUtils();

  const { data: categories } = trpc.document.category.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const createCategory = trpc.document.category.create.useMutation({
    onSuccess: () => {
      utils.document.category.list.invalidate({ projectId });
      setNewName("");
      setShowAdd(false);
      toast.success("Category created");
    },
  });

  const deleteCategory = trpc.document.category.delete.useMutation({
    onSuccess: () => {
      utils.document.category.list.invalidate({ projectId });
      toast.success("Category deleted");
    },
  });

  const allCategories = categories || [];
  const rootCategories = buildTree(allCategories, null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCategory.mutate({
      projectId,
      name: newName.trim(),
      color: newColor,
      parentId: addParentId || undefined,
    });
  };

  function CategoryItem({ cat, depth }: { cat: any; depth: number }) {
    const children = buildTree(allCategories, cat.id);
    const [expanded, setExpanded] = useState(true);
    const isSelected = currentCategory?.id === cat.id;

    return (
      <div>
        <div
          className={cn(
            "group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
            isSelected ? "bg-primary/10 text-primary" : "hover:bg-accent"
          )}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          onClick={() => { onSelect(cat.id); setOpen(false); }}
        >
          {children.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="p-0.5"
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
            </button>
          )}
          {children.length === 0 && <div className="w-4" />}
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="flex-1 truncate">{cat.name}</span>
          {isSelected && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAddParentId(cat.id);
              setShowAdd(true);
            }}
            className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent rounded"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
        {expanded && children.map((child: any) => (
          <CategoryItem key={child.id} cat={child} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">
          Category
        </h4>
      </div>

      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setShowAdd(false); setNewName(""); } }}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 w-full px-3 py-2 rounded-md border border-border hover:border-primary/40 transition-colors text-left text-sm">
            {currentCategory ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentCategory.color }} />
                <span className="flex-1 truncate">
                  {currentCategory.parent && (
                    <span className="text-muted-foreground">{currentCategory.parent.name} / </span>
                  )}
                  {currentCategory.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect(null); }}
                  className="p-0.5 rounded hover:bg-accent"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </>
            ) : (
              <span className="text-muted-foreground italic">Select category...</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          {!showAdd ? (
            <div className="space-y-0.5">
              {/* No category option */}
              <button
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left",
                  !currentCategory && "bg-primary/10 text-primary"
                )}
                onClick={() => { onSelect(null); setOpen(false); }}
              >
                <div className="w-4" />
                <span className="text-muted-foreground italic">None</span>
                {!currentCategory && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
              </button>

              {/* Category tree */}
              {rootCategories.map((cat) => (
                <CategoryItem key={cat.id} cat={cat} depth={0} />
              ))}

              {rootCategories.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No categories yet</p>
              )}

              <div className="border-t border-border my-1.5" />
              <button
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left text-primary"
                onClick={() => { setAddParentId(null); setShowAdd(true); }}
              >
                <Plus className="h-3.5 w-3.5" />
                New category
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground px-1">
                {addParentId ? `Sub-category under ${allCategories.find((c: any) => c.id === addParentId)?.name}` : "New category"}
              </p>
              <Input
                placeholder="Category name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
              <div className="flex items-center gap-1.5 px-1">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      "w-5 h-5 rounded-full transition-all",
                      newColor === c ? "ring-2 ring-offset-1 ring-offset-background ring-primary scale-110" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setNewColor(c)}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 text-xs flex-1" disabled={!newName.trim()} onClick={handleCreate}>
                  Create
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => { setShowAdd(false); setNewName(""); setAddParentId(null); }}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
