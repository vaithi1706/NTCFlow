# DKFlow Documents Module — Implementation Spec

## Overview
Document Version Control inside DKFlow projects. Upload files, track versions, search, compare, organize with folders and tags.

## Design Rules
- NO emoji/smiley icons anywhere. Use Lucide React icons only (FileText, Folder, Upload, Clock, GitCompare, Tag, Search, Download, Eye, RotateCcw, Plus, ChevronRight, MoreHorizontal, Trash2, FolderPlus, FileUp, History, ArrowUpDown, Filter, X, Check, Link2, File, Image, FileSpreadsheet, FileType, Archive)
- Dark theme: bg-slate-950, bg-card, border-border patterns
- Proper alignment: consistent padding (p-4, p-6), gap-3, gap-4
- Use existing DKFlow UI components from @/components/ui/*
- Follow existing code patterns exactly (see board/page.tsx, activity/page.tsx)
- All timestamps use date-fns formatDistanceToNow or format

## Tech Stack
- Prisma ORM for new models (proper migration)
- tRPC router following existing patterns (protectedProcedure, zod validation)
- Multer for file upload (existing /api/upload endpoint pattern)
- Local disk storage at /home/ubuntu/dkflow/uploads/documents/
- PostgreSQL full-text search with raw SQL where needed

## Database Models (Prisma)

### DocumentFolder
- id (uuid PK)
- projectId (FK → Project)
- parentId (nullable FK → self, for nesting)
- name (varchar 255)
- createdById (FK → User)
- createdAt, updatedAt

### Document
- id (uuid PK)
- projectId (FK → Project)
- folderId (nullable FK → DocumentFolder)
- title (varchar 500)
- description (text, nullable)
- currentVersionId (nullable FK → DocumentVersion)
- createdById (FK → User)
- totalVersions (int, default 1)
- fileType (varchar 50) — pdf, docx, xlsx, image, other
- createdAt, updatedAt, deletedAt (soft delete)

### DocumentVersion
- id (uuid PK)
- documentId (FK → Document)
- versionNumber (int)
- fileName (varchar 255)
- fileUrl (text)
- fileSize (int, bytes)
- mimeType (varchar 100)
- versionNote (text, nullable)
- uploadedById (FK → User)
- createdAt

### DocumentTag
- id (uuid PK)
- projectId (FK → Project)
- name (varchar 100)
- color (varchar 7) — hex color
- createdAt

### DocumentTagLink
- documentId (FK → Document)
- tagId (FK → DocumentTag)
- compound PK

### DocumentTaskLink
- documentId (FK → Document)
- taskId (FK → Task)
- compound PK

## API Endpoints (tRPC document router)

### Folders
- folder.list — list folders for project (with nesting)
- folder.create — create folder (name, projectId, parentId?)
- folder.rename — rename folder
- folder.delete — delete folder (must be empty)
- folder.move — move folder to different parent

### Documents
- list — list documents (projectId, folderId?, search?, tagId?, sortBy, sortDir, limit, cursor)
- getById — get document with current version, all tags, task links
- create — upload new document (creates Document + first DocumentVersion)
- uploadVersion — upload new version to existing document
- update — update title, description, folderId
- delete — soft delete document
- restore — restore soft-deleted document
- move — move document to different folder

### Versions
- versions.list — list all versions for a document
- versions.getById — get specific version details
- versions.rollback — set an older version as current (copies it as new version)
- versions.download — get download URL for specific version

### Tags
- tag.list — list tags for project
- tag.create — create tag
- tag.update — update tag name/color
- tag.delete — delete tag
- tag.assign — assign tag to document
- tag.unassign — remove tag from document

### Task Links
- taskLink.list — list linked tasks for document
- taskLink.link — link document to task
- taskLink.unlink — unlink document from task

### Search
- search — full-text search across document titles, descriptions, version notes, tag names

## Frontend Components

### /components/documents/document-browser.tsx
Main component. Layout:
- Left sidebar (240px): folder tree with nested expand/collapse
- Right content: document grid/list view with toolbar
- Toolbar: search input, tag filter dropdown, sort dropdown, view toggle (grid/list), "New Folder" button, "Upload" button
- Grid view: cards showing file icon (by type), title, version count, last updated, tags as small colored badges
- List view: table rows with columns: Name, Type, Versions, Size, Tags, Updated, Actions

### /components/documents/document-upload-dialog.tsx
Dialog for uploading new document or new version:
- Drag-and-drop zone with dashed border
- File picker button
- Title input (auto-filled from filename)
- Description textarea (optional)
- Folder selector dropdown
- Tag multi-select
- Version note input (for new versions)
- Upload progress bar

### /components/documents/document-detail-sheet.tsx
Sheet (slide-over from right, like TaskDetailSheet):
- Header: file type icon + title (editable inline)
- Description (editable)
- Tags section with add/remove
- Linked tasks section with add/remove
- Version history timeline (vertical timeline, each entry: version number, note, uploader avatar+name, date, download button)
- Current version preview (PDF/image inline, others show file info)
- Action buttons: Download Current, Upload New Version, Delete

### /components/documents/version-compare.tsx
Side-by-side version comparison:
- Two dropdowns to select versions (left/right)
- For PDFs/images: side-by-side preview
- For others: show metadata diff (size, name changes)
- Version info below each: number, date, uploader, note

### /components/documents/folder-tree.tsx
Recursive folder tree:
- Indented with ChevronRight expand/collapse icons
- Folder icon (open/closed state)
- Right-click context menu: Rename, Move, Delete
- "All Documents" root option
- "Trash" at bottom (shows soft-deleted docs)
- Drag support for moving docs between folders (optional v1)

### /components/documents/document-card.tsx
Grid card for a single document:
- File type icon (large, centered or top-left)
- Title (truncated)
- Version badge: "v{n}"
- Tag badges (max 3, "+n more")
- Last updated date
- Small avatar of last uploader
- Hover: subtle border highlight

### /components/documents/document-row.tsx  
List row for a single document (table row variant)

## Page File
/app/(dashboard)/[workspaceSlug]/projects/[projectId]/documents/page.tsx
- Uses TopBar with breadcrumbs and view switcher
- Renders DocumentBrowser as main content
- Follows same pattern as board/page.tsx

## TopBar Integration
Add to views array in topbar.tsx:
{ id: "documents", icon: FileText, label: "Documents" }

## File Icons by Type
Use Lucide icons mapped by mimeType:
- PDF → FileText (red-400)
- Word → FileText (blue-400)  
- Excel → FileSpreadsheet (green-400)
- Image → Image (purple-400)
- Archive → Archive (yellow-400)
- Other → File (slate-400)
