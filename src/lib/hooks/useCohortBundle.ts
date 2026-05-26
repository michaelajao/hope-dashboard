"use client";

import { useQuery } from "@tanstack/react-query";

import type { CohortBundle } from "@/lib/server/cohort-data";

const ONE_HOUR = 60 * 60 * 1000;

/**
 * Fetch the real cohort bundle (server-side loaded from `local/`).
 *
 * Returns:
 *  - data: CohortBundle when the file is on disk
 *  - data: null when the route 204s (CI / fresh clone / bundle missing)
 *
 * Consumers should branch on `data` and fall back to synthetic generators
 * when null. Auth-gated via NextAuth; an unauthenticated request rejects
 * at the proxy and React Query surfaces an error.
 */
export function useCohortBundle() {
    return useQuery({
        queryKey: ["cohort-bundle"],
        queryFn: async (): Promise<CohortBundle | null> => {
            const res = await fetch("/api/cohort-bundle");
            if (res.status === 204) return null;
            if (!res.ok) {
                throw new Error(
                    `cohort-bundle failed: ${res.status} ${res.statusText}`,
                );
            }
            return (await res.json()) as CohortBundle;
        },
        staleTime: ONE_HOUR,
        // Single source of truth — never refetch on focus, bundle is static.
        refetchOnWindowFocus: false,
    });
}
