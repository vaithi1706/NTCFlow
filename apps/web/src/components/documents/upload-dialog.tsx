"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileUp, X, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
// Token from localStorage (auth-store doesn't expose it directly)

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  folderId: string | null;
  documentId?: string; // If provided, upload as new version
  onUploaded: (data: {
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    title: string;
    description: string;
    versionNote: string;
  }) => void;
}

export function UploadDialog({
  open,
  onOpenChange,
  projectId,
  folderId,
  documentId,
  onUploaded,
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [versionNote, setVersionNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const isNewVersion = !!documentId;

  const reset = useCallback(() => {
    setFile(null);
    setTitle("");
    setDescription("");
    setVersionNote("");
    setProgress(0);
  }, []);

  const handleFile = (f: File) => {
    setFile(f);
    if (!title && !isNewVersion) {
      const name = f.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setTitle(name.charAt(0).toUpperCase() + name.slice(1));
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [title, isNewVersion]
  );

  const handleUpload = async () => {
    if (!file || (!isNewVersion && !title.trim())) return;
    setUploading(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/document-upload`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      setProgress(70);

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      setProgress(100);

      onUploaded({
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        title: title.trim(),
        description: description.trim(),
        versionNote: versionNote.trim(),
      });

      reset();
      onOpenChange(false);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isNewVersion ? "Upload New Version" : "Upload Document"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : file
                ? "border-green-500/50 bg-green-500/5"
                : "border-border hover:border-primary/40"
            )}
          >
            {file ? (
              <div className="flex items-center gap-3">
                <FileUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Drop file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PDF, Word, Excel, images, and more — up to 50 MB
                  </p>
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {/* Title (new documents only) */}
          {!isNewVersion && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
              />
            </div>
          )}

          {/* Description (new documents only) */}
          {!isNewVersion && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description (optional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this document"
                rows={2}
              />
            </div>
          )}

          {/* Version Note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isNewVersion ? "Version Note" : "Version Note (optional)"}
            </Label>
            <Input
              value={versionNote}
              onChange={(e) => setVersionNote(e.target.value)}
              placeholder={isNewVersion ? "What changed in this version?" : "Initial upload"}
            />
          </div>

          {/* Progress */}
          {uploading && (
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={!file || (!isNewVersion && !title.trim()) || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {isNewVersion ? "Upload Version" : "Upload"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
