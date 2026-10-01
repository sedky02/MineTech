"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { Wordmark } from "@/components/ui/Logo";
import { LoadingScreen, MessageScreen } from "@/components/ui/StatusScreens";
import { useAuth } from "@/hooks/useAuth";
import { type QueueColumn, useModeratorQuestions } from "@/hooks/useQuestions";
import { ApiError } from "@/lib/api/client";
import { type ModeratorAction, moderatorApi, publicApi } from "@/lib/api/endpoints";
import type { Category, ModeratorQuestion } from "@/lib/api/types";
import { ALL_CATEGORIES, CategoryFilter } from "./CategoryFilter";
import { EventControls } from "./EventControls";
import { Author, QuestionCard, formatTime } from "./QuestionCard";
import { SortableList } from "./SortableList";
import styles from "./moderator.module.css";

export function Dashboard() {
  const auth = useAuth("MODERATOR");
  const { dashboard, eventStatus, error, refresh, connection, reorderLocally } = useModeratorQuestions(
    auth.status === "ready",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);

  useEffect(() => {
    publicApi.categories().then(setCategories, () => undefined);
  }, []);

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

  /** Drag-and-drop priority: show the new order at once, then save it. */
  const reorder = (column: QueueColumn, orderedIds: string[]) => {
    reorderLocally(column, orderedIds);
    void run(`reorder:${column}`, () => moderatorApi.reorder(orderedIds));
  };

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
  const queued = [...pending, ...awaitingHost, ...ready];
  const counts: Record<string, number> = {};
  for (const q of queued) counts[q.category.slug] = (counts[q.category.slug] ?? 0) + 1;
  const visible = (list: ModeratorQuestion[]) =>
    categoryFilter === ALL_CATEGORIES ? list : list.filter((q) => q.category.slug === categoryFilter);
  const shown = { pending: visible(pending), awaitingHost: visible(awaitingHost), ready: visible(ready) };
  const hostCurrentId = awaitingHost[0]?.id;

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
              <div className={styles.actions}>
                <button
                  className="btn btn-sm btn-gold"
                  onClick={() => act(previous.id, "rollback")}
                  disabled={busy !== null}
                  title={displayed ? "The question on screen goes back to its list" : undefined}
                >
                  Roll back (show again)
                </button>
              </div>
            </>
          ) : (
            <p className="muted">No answered questions yet.</p>
          )}
        </div>
      </section>

      <CategoryFilter
        categories={categories}
        counts={counts}
        total={queued.length}
        selected={categoryFilter}
        onSelect={setCategoryFilter}
      />

      <section className={styles.columns}>
        <Column
          title="Pending review"
          count={shown.pending.length}
          total={pending.length}
          empty={pending.length ? "No questions in this category." : "No new questions."}
        >
          <SortableList
            items={shown.pending}
            disabled={busy !== null}
            onReorder={(ids) => reorder("pending", ids)}
            renderItem={(q, controls) => (
              <QuestionCard question={q} controls={controls}>
                <button className="btn btn-sm btn-primary" onClick={() => act(q.id, "approve")} disabled={busy !== null}>
                  Approve
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => act(q.id, "reject")} disabled={busy !== null}>
                  Reject
                </button>
              </QuestionCard>
            )}
          />
        </Column>

        <Column
          title="Waiting for host"
          count={shown.awaitingHost.length}
          total={awaitingHost.length}
          empty={awaitingHost.length ? "No questions in this category." : "Nothing waiting for the host."}
        >
          <SortableList
            items={shown.awaitingHost}
            disabled={busy !== null}
            onReorder={(ids) => reorder("awaitingHost", ids)}
            renderItem={(q, controls) => (
              <QuestionCard
                question={q}
                controls={controls}
                note={
                  q.id === hostCurrentId
                    ? "The host is seeing this one now"
                    : `Queued #${awaitingHost.findIndex((other) => other.id === q.id) + 1}`
                }
              >
                <button className="btn btn-sm btn-lapis" onClick={() => act(q.id, "display")} disabled={busy !== null}>
                  Display now (skip host)
                </button>
              </QuestionCard>
            )}
          />
        </Column>

        <Column
          title="Ready to display"
          count={shown.ready.length}
          total={ready.length}
          empty={ready.length ? "No questions in this category." : "Approve questions to fill this list."}
        >
          <SortableList
            items={shown.ready}
            disabled={busy !== null}
            onReorder={(ids) => reorder("ready", ids)}
            renderItem={(q, controls) => (
              <QuestionCard question={q} controls={controls}>
                <button className="btn btn-sm btn-lapis" onClick={() => act(q.id, "display")} disabled={busy !== null}>
                  {displayed ? "Display (answers current)" : "Display"}
                </button>
              </QuestionCard>
            )}
          />
        </Column>
      </section>
    </div>
  );
}

function Column({
  title,
  count,
  total,
  empty,
  children,
}: {
  title: string;
  count: number;
  total: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`panel ${styles.column}`}>
      <h2 className="panel-title">
        {title}
        <span className={styles.count}>
          {count}
          {count !== total && <span className={styles.totalCount}>/{total}</span>}
        </span>
      </h2>
      <div className={styles.list}>{count === 0 ? <p className="muted">{empty}</p> : children}</div>
    </div>
  );
}
