"use client";

import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";

export function usePermissions() {
  const { workspaceId } = useAuthStore();

  const { data, isLoading } = trpc.workspace.getMyPermissions.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId, staleTime: 60_000 }
  );

  const can = (permission: string): boolean => {
    if (!data?.permissions) return false;
    return data.permissions[permission] === true;
  };

  return {
    can,
    role: data?.roleName || null,
    roleColor: data?.roleColor || null,
    permissions: data?.permissions || {},
    isLoading,
  };
}
