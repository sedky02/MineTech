"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./moderator.module.css";

export interface Toast {
  id: number;
  tone: "success" | "error";
  message: string;
}

const SUCCESS_MS = 2500;
/** Errors stay long enough to read, but never block the controls under them for good. */
const ERROR_MS = 8000;

/** Confirmations disappear quickly, errors after a few seconds; either can be dismissed. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone: Toast["tone"], message: string) => {
      const id = ++nextId.current;
      // Keep at most 3 on screen, newest last.
      setToasts((current) => [...current.slice(-2), { id, tone, message }]);
      timers.current.set(id, setTimeout(() => dismiss(id), tone === "success" ? SUCCESS_MS : ERROR_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, push, dismiss };
}

export function ToastRegion({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className={styles.toasts} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toast} data-tone={toast.tone}>
          <span>{toast.message}</span>
          <button type="button" className={styles.toastClose} onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
