import type { PublicEventStatus } from "@/lib/api/types";

/**
 * The last event status this browser saw, so a returning student gets the form
 * at once instead of waiting for the server. The page still asks the server
 * right away and corrects itself; the server stays the source of truth.
 */
const KEY = "mt:event-status:v1";

export function readCachedEventStatus(): PublicEventStatus | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && typeof (value as PublicEventStatus).submissionsOpen === "boolean") {
      return { submissionsOpen: (value as PublicEventStatus).submissionsOpen };
    }
  } catch {
    // Storage blocked or corrupted: behave as if nothing was cached.
  }
  return null;
}

export function writeCachedEventStatus(status: PublicEventStatus) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ submissionsOpen: status.submissionsOpen }));
  } catch {
    // Private mode or full storage: the cache is only an optimisation.
  }
}
