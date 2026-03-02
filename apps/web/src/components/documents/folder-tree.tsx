"use client";

import { useState } from "react";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  FileText,
  Trash2,
  Plus,
  MoreHorizontal,
  Pencil,
  FolderInput,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  _count: { documents: number; children: number };
}

interface FolderTreeProps {
  folders: FolderItem[];
  selectedFolderId: string | null;
  showTrash: boolean;
  onSelect: (folderId: string | null) => void;
  onShowTrash: () => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
}

function buildTree(folders: FolderItem[], parentId: string | null): FolderItem[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function FolderNode({
  folder,
  folders,
  depth,
  selectedFolderId,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: FolderItem;
  folders: FolderItem[];
  depth: number;
  selectedFolderId: string | null;
  onSelect: (id: string) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);
  const [newSubOpen, setNewSubOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const children = buildTree(folders, folder.id);
  const isSelected = selectedFolderId === folder.id;
  const hasChildren = children.length > 0;
  const FolderIcon = expanded ? FolderOpen : Folder;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
          isSelected
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          onSelect(folder.id);
          if (hasChildren) setExpanded(!expanded);
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className={cn("p-0.5 rounded hover:bg-accent", !hasChildren && "invisible")}
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")}
          />
        </button>
        <FolderIcon className="h-4 w-4 text-blue-400 flex-shrink-0" />
        <span className="truncate flex-1">{folder.name}</span>
        <span className="text-xs text-muted-foreground/60 mr-1">
          {folder._count.documents}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setNewSubOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-2" />
              Subfolder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setRenameName(folder.name); setRenameOpen(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteFolder(folder.id)}
              className="text-red-400"
              disabled={folder._count.documents > 0 || folder._count.children > 0}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded &&
        children.map((child) => (
          <FolderNode
            key={child.id}
            folder={child}
            folders={folders}
            depth={depth + 1}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
            onCreateFolder={onCreateFolder}
            onRenameFolder={onRenameFolder}
            onDeleteFolder={onDeleteFolder}
          />
        ))}

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameName.trim()) {
                onRenameFolder(folder.id, renameName.trim());
                setRenameOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (renameName.trim()) {
                  onRenameFolder(folder.id, renameName.trim());
                  setRenameOpen(false);
                }
              }}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Subfolder Dialog */}
      <Dialog open={newSubOpen} onOpenChange={setNewSubOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Subfolder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newSubName}
            onChange={(e) => setNewSubName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSubName.trim()) {
                onCreateFolder(newSubName.trim(), folder.id);
                setNewSubName("");
                setNewSubOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewSubOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (newSubName.trim()) {
                  onCreateFolder(newSubName.trim(), folder.id);
                  setNewSubName("");
                  setNewSubOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function FolderTree({
  folders,
  selectedFolderId,
  showTrash,
  onSelect,
  onShowTrash,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: FolderTreeProps) {
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const rootFolders = buildTree(folders, null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Folders
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setNewFolderOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {/* All Documents */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm transition-colors mx-1",
            selectedFolderId === null && !showTrash
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          onClick={() => onSelect(null)}
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span>All Documents</span>
        </div>

        {/* Folder Tree */}
        <div className="mt-1 mx-1">
          {rootFolders.map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              folders={folders}
              depth={0}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      </div>

      {/* Trash */}
      <div className="border-t border-border py-1 mx-1">
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
            showTrash
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          onClick={onShowTrash}
        >
          <Trash2 className="h-4 w-4 flex-shrink-0" />
          <span>Trash</span>
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newFolderName.trim()) {
                onCreateFolder(newFolderName.trim(), null);
                setNewFolderName("");
                setNewFolderOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (newFolderName.trim()) {
                  onCreateFolder(newFolderName.trim(), null);
                  setNewFolderName("");
                  setNewFolderOpen(false);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
