"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/api/trpc";
import { FolderTree } from "./folder-tree";
import { DocumentCard } from "./document-card";
import { DocumentRow } from "./document-row";
import { DocumentDetailSheet } from "./document-detail-sheet";
import { UploadDialog } from "./upload-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Upload,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  Loader2,
  FileText,
  RotateCcw,
  Layers,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface DocumentBrowserProps {
  projectId: string;
}

export function DocumentBrowser({ projectId }: DocumentBrowserProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiSearch, setAiSearch] = useState(false);
  const [filterTag, setFilterTag] = useState<string | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadVersionDocId, setUploadVersionDocId] = useState<string | undefined>(undefined);

  const utils = trpc.useUtils();

  // Queries
  const { data: foldersData } = trpc.document.folder.list.useQuery({ projectId });
  const folders = foldersData || [];

  const { data: tagsData } = trpc.document.tag.list.useQuery({ projectId });
  const tags = tagsData || [];

  const { data: categoriesData } = trpc.document.category.list.useQuery({ projectId });
  const categories = categoriesData || [];

  const isAiActive = aiSearch && searchQuery.length > 2;

  const { data: docsData, isLoading } = trpc.document.list.useQuery({
    projectId,
    folderId: showTrash ? undefined : selectedFolderId,
    includeDeleted: showTrash,
    search: (!isAiActive && searchQuery) ? searchQuery : undefined,
    tagId: filterTag,
    categoryId: filterCategory,
    sortBy: sortBy as any,
    sortDir,
    limit: 100,
  });
  // AI semantic search
  const { data: aiResults, isLoading: aiLoading, isFetched: aiFetched } = trpc.document.aiSearch.useQuery(
    { projectId, query: searchQuery, limit: 20 },
    { enabled: isAiActive }
  );

  // When AI search is active and has results, use those. Otherwise use regular list.
  const documents = isAiActive && aiFetched && aiResults
    ? aiResults
    : (docsData?.documents || []);
  
  const isSearching = isAiActive ? aiLoading : isLoading;

  const { data: selectedDoc } = trpc.document.getById.useQuery(
    { id: selectedDocId! },
    { enabled: !!selectedDocId }
  );

  // Mutations
  const createFolder = trpc.document.folder.create.useMutation({
    onSuccess: () => {
      utils.document.folder.list.invalidate({ projectId });
      toast.success("Folder created");
    },
  });
  const renameFolder = trpc.document.folder.rename.useMutation({
    onSuccess: () => {
      utils.document.folder.list.invalidate({ projectId });
      toast.success("Folder renamed");
    },
  });
  const deleteFolder = trpc.document.folder.delete.useMutation({
    onSuccess: () => {
      utils.document.folder.list.invalidate({ projectId });
      toast.success("Folder deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const createDoc = trpc.document.create.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Document uploaded");
    },
  });
  const uploadVersion = trpc.document.uploadVersion.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("New version uploaded");
    },
  });
  const updateDoc = trpc.document.update.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Document updated");
    },
  });
  const deleteDoc = trpc.document.delete.useMutation({
    onSuccess: () => {
      invalidateAll();
      setSelectedDocId(null);
      toast.success("Document moved to trash");
    },
  });
  const restoreDoc = trpc.document.restore.useMutation({
    onSuccess: () => {
      invalidateAll();
      setSelectedDocId(null);
      toast.success("Document restored");
    },
  });
  const rollbackVersion = trpc.document.version.rollback.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Version rolled back");
    },
  });

  function invalidateAll() {
    utils.document.list.invalidate();
    utils.document.getById.invalidate();
    utils.document.folder.list.invalidate();
    utils.document.category.list.invalidate();
  }

  const handleUploaded = (data: any) => {
    if (uploadVersionDocId) {
      uploadVersion.mutate({
        documentId: uploadVersionDocId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        versionNote: data.versionNote || undefined,
      });
    } else {
      createDoc.mutate({
        projectId,
        title: data.title,
        description: data.description || undefined,
        folderId: selectedFolderId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        versionNote: data.versionNote || undefined,
      });
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar — Folder Tree */}
      <div className="w-60 flex-shrink-0 border-r border-border bg-card/50 hidden md:block">
        <FolderTree
          folders={folders}
          selectedFolderId={selectedFolderId}
          showTrash={showTrash}
          onSelect={(id) => {
            setSelectedFolderId(id);
            setShowTrash(false);
          }}
          onShowTrash={() => {
            setShowTrash(true);
            setSelectedFolderId(null);
          }}
          onCreateFolder={(name, parentId) =>
            createFolder.mutate({ projectId, name, parentId: parentId || undefined })
          }
          onRenameFolder={(id, name) => renameFolder.mutate({ id, name })}
          onDeleteFolder={(id) => deleteFolder.mutate({ id })}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={aiSearch ? "Ask AI: e.g. 'find payment docs'..." : "Search documents..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-8 pr-9 h-8 text-sm ${aiSearch ? "border-violet-500/50 bg-violet-500/5" : ""}`}
            />
            <button
              onClick={() => setAiSearch(!aiSearch)}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                aiSearch
                  ? "text-violet-400 bg-violet-500/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              title={aiSearch ? "AI Search ON — semantic search using AI" : "Switch to AI Search"}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </div>
          {aiSearch && searchQuery && (aiLoading) && (
            <div className="flex items-center gap-1.5 text-xs text-violet-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching with AI...
            </div>
          )}

          {/* Tag Filter */}
          {tags.length > 0 && (
            <Select
              value={filterTag || "all"}
              onValueChange={(v) => setFilterTag(v === "all" ? undefined : v)}
            >
              <SelectTrigger className="w-36 h-8">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {tags.map((tag: any) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Category Filter */}
          {categories.length > 0 && (
            <Select
              value={filterCategory || "all"}
              onValueChange={(v) => setFilterCategory(v === "all" ? undefined : v)}
            >
              <SelectTrigger className="w-40 h-8">
                <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories
                  .filter((c: any) => !c.parentId)
                  .map((cat: any) => {
                    const children = categories.filter((c: any) => c.parentId === cat.id);
                    return [
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </div>
                      </SelectItem>,
                      ...children.map((child: any) => (
                        <SelectItem key={child.id} value={child.id}>
                          <div className="flex items-center gap-2 pl-3">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: child.color }} />
                            {child.name}
                          </div>
                        </SelectItem>
                      )),
                    ];
                  })}
              </SelectContent>
            </Select>
          )}

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36 h-8">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">Last Updated</SelectItem>
              <SelectItem value="createdAt">Created</SelectItem>
              <SelectItem value="title">Name</SelectItem>
              <SelectItem value="totalVersions">Versions</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-md">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-l-md transition-colors ${
                viewMode === "grid"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-r-md transition-colors ${
                viewMode === "list"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Upload Button */}
          {!showTrash && (
            <Button
              size="sm"
              onClick={() => {
                setUploadVersionDocId(undefined);
                setUploadOpen(true);
              }}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Upload
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isSearching ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-sm font-medium mb-1">
                {showTrash ? "Trash is empty" : "No documents yet"}
              </h3>
              <p className="text-xs text-muted-foreground max-w-[240px]">
                {showTrash
                  ? "Deleted documents will appear here"
                  : "Upload your first document to start tracking versions"}
              </p>
              {!showTrash && (
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setUploadVersionDocId(undefined);
                    setUploadOpen(true);
                  }}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload Document
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {documents.map((doc: any) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onClick={() => setSelectedDocId(doc.id)}
                />
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              {/* List Header */}
              <div className="flex items-center gap-4 px-4 py-2 bg-muted/30 border-b border-border text-xs font-medium text-muted-foreground">
                <div className="w-8" />
                <div className="flex-1">Name</div>
                <div className="hidden md:block w-32">Category</div>
                <div className="hidden lg:block w-[200px]">Tags</div>
                <div className="w-12">Ver.</div>
                <div className="hidden lg:block w-16 text-right">Size</div>
                <div className="w-8" />
                <div className="w-32 text-right">Updated</div>
              </div>
              {documents.map((doc: any) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onClick={() => setSelectedDocId(doc.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Sheet */}
      {selectedDoc && (
        <DocumentDetailSheet
          document={selectedDoc}
          projectId={projectId}
          onClose={() => setSelectedDocId(null)}
          onUploadVersion={() => {
            setUploadVersionDocId(selectedDoc.id);
            setUploadOpen(true);
          }}
          onDelete={() => deleteDoc.mutate({ id: selectedDoc.id })}
          onRestore={() => restoreDoc.mutate({ id: selectedDoc.id })}
          onRollback={(versionId) =>
            rollbackVersion.mutate({ documentId: selectedDoc.id, versionId })
          }
          onUpdate={(data) => updateDoc.mutate({ id: selectedDoc.id, ...data })}
          onRefresh={invalidateAll}
        />
      )}

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        projectId={projectId}
        folderId={selectedFolderId}
        documentId={uploadVersionDocId}
        onUploaded={handleUploaded}
      />
    </div>
  );
}
