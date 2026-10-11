import { API_URL } from "@/lib/config";

/** A health check gives up after this long, so a sleeping server reads as "not up yet". */
const HEALTH_TIMEOUT_MS = 8_000;

/**
 * True when the API and its database answer. Never throws. Sends no cookies:
 * it only wakes the server (the free hosting plan sleeps after inactivity).
 */
export async function isServerUp(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/health`, { cache: "no-store", signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

let wakeRequest: Promise<boolean> | undefined;

/** Fires one health request per page load, so the server starts waking while the page is read. */
export function wakeServer(): Promise<boolean> {
  wakeRequest ??= isServerUp();
  return wakeRequest;
}
