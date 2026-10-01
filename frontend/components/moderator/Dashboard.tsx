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
import { EVENT_NAME } from "@/lib/config";
import { ALL_CATEGORIES, CategoryFilter } from "./CategoryFilter";
import { ConfirmDialog } from "./ConfirmDialog";
import { EventControls } from "./EventControls";
import { Author, QuestionCard, formatTime } from "./QuestionCard";
import { SortableList } from "./SortableList";
import { ToastRegion, useToasts } from "./Toasts";
import styles from "./moderator.module.css";

/** Pending questions younger than this get a "New" tag. */
const NEW_FOR_MS = 2 * 60_000;
const CLOCK_TICK_MS = 30_000;

const SUCCESS_MESSAGES: Record<ModeratorAction, string> = {
  approve: "Sent to the host",
  reject: "Question rejected",
  display: "On screen now",
  remove: "Removed from screen",
  answer: "Marked as answered",
  rollback: "Previous question is back on screen",
};

/** Actions after which the card leaves its list, so focus moves to its neighbour. */
const LEAVES_LIST: ModeratorAction[] = ["approve", "reject", "display"];

function describeError(error: unknown) {
  if (error instanceof ApiError && error.status === 409) {
    return "That question was already handled. The lists are now up to date.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

/** If keyboard focus is inside this card, the id of the card that should take focus after it leaves. */
function neighbourOf(id: string): string | undefined {
  const card = document.querySelector<HTMLElement>(`article[data-question-id="${id}"]`);
  if (!card?.contains(document.activeElement)) return undefined;
  const cards = [...document.querySelectorAll<HTMLElement>(`article[data-column="${card.dataset.column}"]`)];
  const index = cards.indexOf(card);
  return (cards[index + 1] ?? cards[index - 1])?.dataset.questionId;
}

function focusCard(id: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`article[data-question-id="${id}"]`)?.focus());
}

export function Dashboard() {
  const auth = useAuth("MODERATOR");
  const { dashboard, eventStatus, error, refresh, connection, reorderLocally } = useModeratorQuestions(
    auth.status === "ready",
  );
  const { toasts, push, dismiss } = useToasts();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    publicApi.categories().then(setCategories, () => undefined);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Pending count in the tab title, visible while the moderator is in another tab.
  const pendingCount = dashboard?.pending.length ?? 0;
  useEffect(() => {
    document.title = `${pendingCount > 0 ? `(${pendingCount}) ` : ""}Moderator · ${EVENT_NAME}`;
  }, [pendingCount]);

  async function run(key: string, action: () => Promise<unknown>, success?: string, focusNext?: string) {
    setBusy((current) => new Set(current).add(key));
    try {
      await action();
      if (success) push("success", success);
    } catch (e) {
      push("error", describeError(e));
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      await refresh();
      if (focusNext) focusCard(focusNext);
    }
  }

  const act = (id: string, action: ModeratorAction) =>
    run(
      `question:${id}`,
      () => moderatorApi.act(id, action),
      SUCCESS_MESSAGES[action],
      LEAVES_LIST.includes(action) ? neighbourOf(id) : undefined,
    );
  const isBusy = (id: string) => busy.has(`question:${id}`);
  const eventBusy = busy.has("event");

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
  const isNew = (q: ModeratorQuestion) => now - new Date(q.createdAt).getTime() < NEW_FOR_MS;
  const showLabel = displayed ? "Show (replaces current)" : "Show on screen";

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Wordmark size={36} subtitle={`Moderator · ${auth.user.username}`} />
        <ConnectionBadge status={connection} />
        <button className={`btn btn-ghost btn-sm ${styles.logout}`} onClick={auth.logout}>
          Log out
        </button>
      </header>

      <EventControls
        status={eventStatus}
        dashboard={dashboard}
        busy={eventBusy}
        onToggleSubmissions={() =>
          eventStatus?.paused
            ? void run("event", moderatorApi.resume, "Questions are open again")
            : void run("event", moderatorApi.pause, "Questions paused")
        }
        onClearScreen={() => displayed && act(displayed.id, "remove")}
        onEndEvent={() => setConfirmEnd(true)}
      />

      {connection === "reconnecting" && (
        <div className="alert" role="status">
          Live updates are reconnecting. The lists refresh every 5 seconds until they&apos;re back.
        </div>
      )}
      {connection === "unauthorized" && (
        <div className="alert alert-error" role="alert">
          Your session expired. <Link href="/login?next=/moderator">Log in again</Link> to keep moderating.
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          Couldn&apos;t refresh the lists: {error}
        </div>
      )}

      <section className={styles.stage}>
        <div className={`panel ${styles.onScreen}`} data-live={!!displayed || undefined}>
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
                  disabled={isBusy(displayed.id)}
                >
                  Mark answered
                </button>
                <button
                  className="btn btn-quiet"
                  onClick={() => act(displayed.id, "remove")}
                  disabled={isBusy(displayed.id)}
                >
                  Remove from screen
                </button>
              </div>
            </>
          ) : (
            <p className="muted">The projector shows the event logo. Pick a question from Ready to show it.</p>
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
                  className="btn btn-sm btn-quiet"
                  onClick={() => act(previous.id, "rollback")}
                  disabled={isBusy(previous.id)}
                  title={displayed ? "The question on screen goes back to its list" : undefined}
                >
                  Roll back to this
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Answered questions appear here, so you can bring one back.</p>
          )}
        </div>
      </section>

      <div className={styles.listTools}>
        <CategoryFilter
          categories={categories}
          counts={counts}
          total={queued.length}
          selected={categoryFilter}
          onSelect={setCategoryFilter}
        />
        <p className={styles.shortcuts}>
          Keyboard: Tab to a question, then <kbd>A</kbd> send to host · <kbd>R</kbd> reject · <kbd>S</kbd> show on
          screen · <kbd>Alt</kbd>+<kbd>↑</kbd>
          <kbd>↓</kbd> change priority
        </p>
      </div>

      <section className={styles.columns}>
        <Column
          title="To review"
          hint="New questions from students"
          count={shown.pending.length}
          total={pending.length}
          attention={pending.length > 0}
          empty={pending.length ? "No questions in this category." : "No new questions. They appear here instantly."}
        >
          <SortableList
            items={shown.pending}
            disabled={busy.has("reorder:pending")}
            onReorder={(ids) => reorder("pending", ids)}
            renderItem={(q, controls, moves) => (
              <QuestionCard
                question={q}
                column="pending"
                controls={controls}
                isNew={isNew(q)}
                busy={isBusy(q.id)}
                shortcuts={{ keys: { a: () => act(q.id, "approve"), r: () => act(q.id, "reject") }, ...moves }}
              >
                <button className="btn btn-sm btn-primary" onClick={() => act(q.id, "approve")} disabled={isBusy(q.id)}>
                  Send to host
                </button>
                <button
                  className="btn btn-sm btn-quiet-danger"
                  onClick={() => act(q.id, "reject")}
                  disabled={isBusy(q.id)}
                >
                  Reject
                </button>
              </QuestionCard>
            )}
          />
        </Column>

        <Column
          title="With host"
          hint="The host approves the first one"
          count={shown.awaitingHost.length}
          total={awaitingHost.length}
          empty={awaitingHost.length ? "No questions in this category." : "Nothing waiting for the host."}
        >
          <SortableList
            items={shown.awaitingHost}
            disabled={busy.has("reorder:awaitingHost")}
            onReorder={(ids) => reorder("awaitingHost", ids)}
            renderItem={(q, controls, moves) => {
              const place = awaitingHost.findIndex((other) => other.id === q.id);
              return (
                <QuestionCard
                  question={q}
                  column="awaitingHost"
                  controls={controls}
                  busy={isBusy(q.id)}
                  shortcuts={{ keys: { s: () => act(q.id, "display") }, ...moves }}
                  note={
                    place === 0 ? (
                      <span className={styles.hostPill}>Host is reviewing</span>
                    ) : (
                      `#${place + 1} in the host's queue`
                    )
                  }
                >
                  <button
                    className="btn btn-sm btn-lapis"
                    onClick={() => act(q.id, "display")}
                    disabled={isBusy(q.id)}
                  >
                    Show now (skip host)
                  </button>
                </QuestionCard>
              );
            }}
          />
        </Column>

        <Column
          title="Ready"
          hint="Approved by the host"
          count={shown.ready.length}
          total={ready.length}
          empty={ready.length ? "No questions in this category." : "Questions the host approves land here."}
        >
          <SortableList
            items={shown.ready}
            disabled={busy.has("reorder:ready")}
            onReorder={(ids) => reorder("ready", ids)}
            renderItem={(q, controls, moves) => (
              <QuestionCard
                question={q}
                column="ready"
                controls={controls}
                busy={isBusy(q.id)}
                shortcuts={{ keys: { s: () => act(q.id, "display") }, ...moves }}
              >
                <button className="btn btn-sm btn-lapis" onClick={() => act(q.id, "display")} disabled={isBusy(q.id)}>
                  {showLabel}
                </button>
              </QuestionCard>
            )}
          />
        </Column>
      </section>

      <ToastRegion toasts={toasts} onDismiss={dismiss} />

      <ConfirmDialog
        open={confirmEnd}
        title="End the event?"
        confirmLabel="End event"
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false);
          void run("event", moderatorApi.end, "Event ended");
        }}
      >
        <p>Students can no longer send questions, and the projector shows the event logo.</p>
        <p className="muted">Questions already in your lists stay available. This can&apos;t be undone.</p>
      </ConfirmDialog>
    </div>
  );
}

function Column({
  title,
  hint,
  count,
  total,
  attention,
  empty,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  total: number;
  attention?: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`panel ${styles.column}`}>
      <div className={styles.columnHeader}>
        <h2 className="panel-title">{title}</h2>
        <span className={styles.count} data-attention={attention || undefined}>
          {count}
          {count !== total && <span className={styles.totalCount}>/{total}</span>}
        </span>
        <p className={styles.columnHint}>{hint}</p>
      </div>
      <div className={styles.list}>{count === 0 ? <p className="muted">{empty}</p> : children}</div>
    </div>
  );
}
