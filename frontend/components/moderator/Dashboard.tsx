"use client";

import Link from "next/link";
import { useState } from "react";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { Wordmark } from "@/components/ui/Logo";
import { LoadingScreen, MessageScreen } from "@/components/ui/StatusScreens";
import { useAuth } from "@/hooks/useAuth";
import { useModeratorQuestions } from "@/hooks/useQuestions";
import { ApiError } from "@/lib/api/client";
import { type ModeratorAction, moderatorApi } from "@/lib/api/endpoints";
import { EventControls } from "./EventControls";
import { Author, QuestionCard, formatTime } from "./QuestionCard";
import styles from "./moderator.module.css";

export function Dashboard() {
  const auth = useAuth("MODERATOR");
  const { dashboard, eventStatus, error, refresh, connection } = useModeratorQuestions(auth.status === "ready");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(
        e instanceof ApiError && e.status === 409
          ? `${e.message}. Someone else may have acted first, so the list was refreshed.`
          : e instanceof Error
            ? e.message
            : "Action failed",
      );
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  const act = (id: string, action: ModeratorAction) => run(`${id}:${action}`, () => moderatorApi.act(id, action));

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
        title="Moderators only"
        message={`You are signed in as ${auth.user.username} (host).`}
        action={
          <Link className="btn" href="/host">
            Go to host view
          </Link>
        }
      />
    );
  }
  if (!dashboard) return <LoadingScreen label={error ?? "Loading questions…"} />;

  const { pending, awaitingHost, ready, displayed, previous } = dashboard;

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Wordmark size={36} subtitle={`Moderator · ${auth.user.username}`} />
        <ConnectionBadge status={connection} />
        <EventControls
          status={eventStatus}
          hasDisplayed={!!displayed}
          busy={busy !== null}
          onPause={() => run("pause", moderatorApi.pause)}
          onResume={() => run("resume", moderatorApi.resume)}
          onClearDisplay={() => displayed && act(displayed.id, "remove")}
          onEnd={() => {
            if (window.confirm("End the event? Submissions close for good and the screen shows the logo.")) {
              void run("end", moderatorApi.end);
            }
          }}
        />
        <button className="btn btn-ghost btn-sm" onClick={auth.logout}>
          Log out
        </button>
      </header>

      {connection === "unauthorized" && (
        <div className="alert alert-error" role="alert">
          Your session expired. <Link href="/login?next=/moderator">Log in again</Link>.
        </div>
      )}
      {(actionError || error) && (
        <div className="alert alert-error" role="alert">
          {actionError ?? error}
        </div>
      )}

      <section className={styles.stage}>
        <div className={`panel ${styles.onScreen}`}>
          <h2 className="panel-title">
            <span className={styles.liveDot} data-live={!!displayed} aria-hidden /> On screen
          </h2>
          {displayed ? (
            <>
              <CategoryTag category={displayed.category} />
              <p className={styles.onScreenText}>{displayed.content}</p>
              <Author name={displayed.displayName} />
              <div className={styles.actions}>
                <button
                  className="btn btn-primary"
                  onClick={() => act(displayed.id, "answer")}
                  disabled={busy !== null}
                >
                  Mark answered
                </button>
                <button className="btn" onClick={() => act(displayed.id, "remove")} disabled={busy !== null}>
                  Remove (show logo)
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Nothing on screen. The presentation shows the event logo.</p>
          )}
        </div>

        <div className={`panel ${styles.previous}`}>
          <h2 className="panel-title">Previous question</h2>
          {previous ? (
            <>
              <CategoryTag category={previous.category} />
              <p className={styles.content}>{previous.content}</p>
              <Author name={previous.displayName} />
              <p className={styles.note}>Answered at {formatTime(previous.answeredAt)}</p>
            </>
          ) : (
            <p className="muted">No answered questions yet.</p>
          )}
        </div>
      </section>

      <section className={styles.columns}>
        <Column title="Pending review" count={pending.length} empty="No new questions.">
          {pending.map((q) => (
            <QuestionCard key={q.id} question={q}>
              <button className="btn btn-sm btn-primary" onClick={() => act(q.id, "approve")} disabled={busy !== null}>
                Approve
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => act(q.id, "reject")} disabled={busy !== null}>
                Reject
              </button>
            </QuestionCard>
          ))}
        </Column>

        <Column title="Waiting for host" count={awaitingHost.length} empty="Nothing waiting for the host.">
          {awaitingHost.map((q, index) => (
            <QuestionCard
              key={q.id}
              question={q}
              note={index === 0 ? "The host is seeing this one now" : `Queued #${index + 1}`}
            />
          ))}
        </Column>

        <Column title="Ready to display" count={ready.length} empty="Approve questions to fill this list.">
          {ready.map((q) => (
            <QuestionCard key={q.id} question={q}>
              <button className="btn btn-sm btn-lapis" onClick={() => act(q.id, "display")} disabled={busy !== null}>
                {displayed ? "Display (answers current)" : "Display"}
              </button>
            </QuestionCard>
          ))}
        </Column>
      </section>
    </div>
  );
}

function Column({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`panel ${styles.column}`}>
      <h2 className="panel-title">
        {title} <span className={styles.count}>{count}</span>
      </h2>
      <div className={styles.list}>{count === 0 ? <p className="muted">{empty}</p> : children}</div>
    </div>
  );
}
