/**
 * API client wrappers using the tRPC vanilla client.
 * Used in places that can't use React hooks (e.g. event handlers in non-hook contexts).
 * For React components, prefer using `trpc.xxx.useQuery()` / `trpc.xxx.useMutation()` directly.
 */
import { trpcVanilla } from "./trpc";

// Re-export for backwards compatibility during migration
export const api = trpcVanilla;
