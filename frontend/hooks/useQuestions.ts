"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { moderatorApi } from "@/lib/api/endpoints";
import type { EventStatus, ModeratorDashboard } from "@/lib/api/types";
import { useSocket } from "./useSocket";

const EVENT_DEBOUNCE_MS = 80;

/**
 * Moderator dashboard state. Socket events are treated as "something
 * changed" signals that trigger a refetch, so the dashboard always mirrors
 * the database rather than a locally patched copy.
 */
export function useModeratorQuestions(enabled: boolean) {
  const [dashboard, setDashboard] = useState<ModeratorDashboard | null>(null);
  const [eventStatus, setEventStatus] = useState<EventStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRequest = useRef(0);
  const lastApplied = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refresh = useCallback(async () => {
    const id = ++lastRequest.current;
    try {
      const [nextDashboard, nextStatus] = await Promise.all([moderatorApi.dashboard(), moderatorApi.eventStatus()]);
      // Ignore responses that finish after a newer one was already applied.
      if (id < lastApplied.current) return;
      lastApplied.current = id;
      setDashboard(nextDashboard);
      setEventStatus(nextStatus);
      setError(null);
    } catch (e) {
      if (id >= lastApplied.current) setError(e instanceof Error ? e.message : "Failed to load questions");
    }
  }, []);

  const scheduleRefresh = useCallback(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void refresh(), EVENT_DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => () => clearTimeout(debounce.current), []);

  const connection = useSocket({ kind: "internal", enabled, onSync: refresh, onEvent: scheduleRefresh });

  return { dashboard, eventStatus, error, refresh, connection };
}
