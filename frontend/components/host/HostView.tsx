"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { Logo } from "@/components/ui/Logo";
import { LoadingScreen, MessageScreen } from "@/components/ui/StatusScreens";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { hostApi } from "@/lib/api/endpoints";
import type { PublicQuestion } from "@/lib/api/types";
import styles from "./host.module.css";

/** Buttons stay disabled briefly when a new question appears, so a double tap can't approve it by accident. */
const ARM_DELAY_MS = 700;

/**
 * Deliberately minimal (SPEC §6): one question, Approve or Reject. No queue,
 * no counts, no moderation or presentation controls.
 */
export function HostView() {
  const auth = useAuth("HOST");
  const [question, setQuestion] = useState<PublicQuestion | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const lastRequest = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++lastRequest.current;
    try {
      const result = await hostApi.current();
      if (id !== lastRequest.current) return;
      setQuestion(result.question);
      setError(null);
    } catch (e) {
      if (id === lastRequest.current) setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  const connection = useSocket({
    kind: "internal",
    enabled: auth.status === "ready",
    onSync: refresh,
    onEvent: () => void refresh(),
  });

  async function decide(decision: "approve" | "reject", id: string) {
    setError(null);
    try {
      await hostApi[decision](id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
    await refresh();
  }

  if (auth.status === "loading") return <LoadingScreen />;
  if (auth.status === "error") {
    return (
      <MessageScreen
        title="Can't reach the server"
        message={auth.message}
        action={
          <button className="btn" onClick={auth.retry}>
            Retry
          </button>
        }
      />
    );
  }
  if (auth.status === "wrong-role") {
    return (
      <MessageScreen
        title="Host only"
        message={`You are signed in as ${auth.user.username} (moderator).`}
        action={
          <Link className="btn" href="/moderator">
            Go to moderator dashboard
          </Link>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <ConnectionBadge status={connection} />
        <button className="btn btn-ghost btn-sm" onClick={auth.logout}>
          Log out
        </button>
      </header>

      {connection === "unauthorized" && (
        <div className="alert alert-error" role="alert">
          Your session expired. <Link href="/login?next=/host">Log in again</Link>.
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <main className={styles.main}>
        {question === undefined ? (
          <p className="muted">Loading…</p>
        ) : question === null ? (
          <div className={styles.idle}>
            <Logo size={72} />
            <p className={styles.idleText}>No question waiting</p>
            <p className="muted">Focus on the speakers. New questions appear here automatically.</p>
          </div>
        ) : (
          <CurrentQuestion key={question.id} question={question} onDecide={decide} />
        )}
      </main>
    </div>
  );
}

function CurrentQuestion({
  question,
  onDecide,
}: {
  question: PublicQuestion;
  onDecide: (decision: "approve" | "reject", id: string) => Promise<void>;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), ARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    await onDecide(decision, question.id);
    setBusy(false);
  }

  const disabled = !armed || busy;

  return (
    <section className={`panel ${styles.question}`} aria-live="polite">
      <h1 className="panel-title">Current question</h1>
      <CategoryTag category={question.category} />
      <p className={styles.text}>{question.content}</p>
      <p className={styles.author}>{question.displayName ? `— ${question.displayName}` : "— Anonymous"}</p>
      <div className={styles.buttons}>
        <button className="btn btn-danger btn-lg" onClick={() => decide("reject")} disabled={disabled}>
          Reject
        </button>
        <button className="btn btn-primary btn-lg" onClick={() => decide("approve")} disabled={disabled}>
          Approve
        </button>
      </div>
    </section>
  );
}
