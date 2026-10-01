"use client";

import { useEffect, useRef, useState } from "react";
import { createSocket } from "@/lib/socket/client";
import type { SocketEvent } from "@/lib/socket/events";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "unauthorized";

const FALLBACK_POLL_MS = 5000;

interface UseSocketOptions {
  kind: "internal" | "presentation";
  enabled?: boolean;
  /** Fetches the current server state over REST. Called on every (re)connect. */
  onSync: () => void;
  onEvent?: (event: SocketEvent, payload: unknown) => void;
}

/**
 * Socket.IO is only a delivery channel (SPEC §12): we never assume every
 * event arrived. On each (re)connect, when the tab becomes visible again, and
 * periodically while disconnected, the UI resyncs from the database via REST.
 */
export function useSocket({ kind, enabled = true, onSync, onEvent }: UseSocketOptions): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const onSyncRef = useRef(onSync);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onSyncRef.current = onSync;
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return;
    const socket = createSocket(kind);
    socket.on("connect", () => {
      setStatus("connected");
      onSyncRef.current();
    });
    socket.on("disconnect", () => setStatus("reconnecting"));
    // An auth failure in the server middleware is final (socket.active is
    // false); transport errors keep retrying automatically.
    socket.on("connect_error", () => setStatus(socket.active ? "reconnecting" : "unauthorized"));
    socket.onAny((event: SocketEvent, payload: unknown) => onEventRef.current?.(event, payload));
    return () => {
      socket.removeAllListeners();
      socket.close();
    };
  }, [kind, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") onSyncRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = status === "connected" ? undefined : setInterval(() => onSyncRef.current(), FALLBACK_POLL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [enabled, status]);

  return status;
}
