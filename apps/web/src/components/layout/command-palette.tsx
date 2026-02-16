"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { trpc } from "@/lib/api/trpc";
import {
  Home, FolderKanban, Settings, FileText,
} from "lucide-react";

export function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { workspaceId } = useAuthStore();
  const [query, setQuery] = useState("");

  const { data: projects } = trpc.project.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId && commandPaletteOpen }
  );

  const { data: workspaces } = trpc.workspace.list.useQuery(undefined, {
    enabled: !!workspaceId && commandPaletteOpen,
  });
  const wsSlug = workspaces?.find((w: any) => w.id === workspaceId)?.slug || "workspace";

  const { data: searchResults } = trpc.search.global.useQuery(
    { query, workspaceId: workspaceId || undefined },
    { enabled: !!query && query.length >= 1 && commandPaletteOpen }
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (!commandPaletteOpen) setQuery("");
  }, [commandPaletteOpen]);

  const runCommand = (fn: () => void) => {
    setCommandPaletteOpen(false);
    fn();
  };

  const searchTasks = searchResults?.tasks || [];
  const searchProjects = searchResults?.projects || [];

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput
        placeholder="Search tasks, projects, or type a command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Search results */}
        {query && searchTasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {searchTasks.map((task: any) => (
              <CommandItem
                key={task.id}
                onSelect={() => runCommand(() => router.push(`/${wsSlug}/projects/${task.projectId}/board`))}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span className="flex-1 truncate">{task.title}</span>
                <span className="text-xs text-muted-foreground ml-2">{task.project?.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {query && searchProjects.length > 0 && (
          <CommandGroup heading="Projects (Search)">
            {searchProjects.map((p: any) => (
              <CommandItem
                key={p.id}
                onSelect={() => runCommand(() => router.push(`/${wsSlug}/projects/${p.id}/board`))}
              >
                <span className="mr-2 h-2.5 w-2.5 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: p.color || "#94A3B8" }} />
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!query && (
          <>
            <CommandGroup heading="Quick Actions">
              <CommandItem onSelect={() => runCommand(() => {})}>
                <FolderKanban className="mr-2 h-4 w-4" />
                Create New Project
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => runCommand(() => router.push("/home"))}>
                <Home className="mr-2 h-4 w-4" />
                Home
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </CommandItem>
            </CommandGroup>

            {projects && projects.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Projects">
                  {projects.map((project) => (
                    <CommandItem
                      key={project.id}
                      onSelect={() => runCommand(() => router.push(`/${wsSlug}/projects/${project.id}/board`))}
                    >
                      <span
                        className="mr-2 h-2.5 w-2.5 rounded-full flex-shrink-0 inline-block"
                        style={{ backgroundColor: project.color || "#94A3B8" }}
                      />
                      {project.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
