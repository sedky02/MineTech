"use client";

import { Google_Sans } from "next/font/google";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { ConnectionBadge } from "@/components/ui/ConnectionBadge";
import { Wordmark } from "@/components/ui/Logo";
import { LoadingScreen, MessageScreen } from "@/components/ui/StatusScreens";
import { useAuth } from "@/hooks/useAuth";
import { type QueueColumn, useModeratorQuestions } from "@/hooks/useQuestions";
import { ApiError } from "@/lib/api/client";
import { type ModeratorAction, moderatorApi } from "@/lib/api/endpoints";
import type { ModeratorQuestion } from "@/lib/api/types";
import { CATEGORIES } from "@/lib/categories";
import { EVENT_NAME } from "@/lib/config";
import { ALL_CATEGORIES, CategoryFilter } from "./CategoryFilter";
import { EventControls } from "./EventControls";
import { Author, QuestionCard, formatTime } from "./QuestionCard";
import { SortableList } from "./SortableList";
import { ToastRegion, useToasts } from "./Toasts";
import styles from "./moderator.module.css";

/**
 * The moderator screen is set in the projector's reading face (Google Sans):
 * Sarpanch's "a" reads like an "o" at body size, which slows down moderation.
 */
const questionFont = Google_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-question",
  display: "swap",
});

/** Pending questions younger than this get a "New" tag. */
const NEW_FOR_MS = 2 * 60_000;
const CLOCK_TICK_MS = 30_000;

const SUCCESS_MESSAGES: Record<ModeratorAction, string> = {
  approve: "Sent to the host",
  reject: "Question rejected",
  display: "Shown on screen",
  // Overridden in the On screen panel: it names the list the question went back to.
  remove: "Taken off screen",
  answer: "Marked as answered",
  rollback: "Shown again",
  review: "Returned to review",
};

/** Actions after which the card leaves its list, so focus moves to its neighbour. */
const LEAVES_LIST: ModeratorAction[] = ["approve", "reject", "display", "rollback", "review"];

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

/** Moves keyboard focus to the first enabled button of a card (cards themselves aren't focusable). */
function focusCard(id: string) {
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>(`article[data-question-id="${id}"] button:not(:disabled)`)?.focus(),
  );
}

export function Dashboard() {
  const auth = useAuth("MODERATOR");
  const { dashboard, eventStatus, error, refresh, connection, reorderLocally } = useModeratorQuestions(
    auth.status === "ready",
  );
  const { toasts, push, dismiss } = useToasts();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState(readTopicFromUrl);
  const selectCategory = (slug: string) => {
    setCategoryFilter(slug);
    writeTopicToUrl(slug);
  };
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Pending count in the tab title, visible while the moderator is in another tab.
  const pendingCount = dashboard?.pending.length ?? 0;
  useEffect(() => {
    document.title = `${pendingCount > 0 ? `(${pendingCount}) ` : ""}Moderator · ${EVENT_NAME}`;
  }, [pendingCount]);

  /**
   * Runs one action: marks it busy, shows a toast, refreshes from the server.
   * Resolves to whether the action succeeded.
   */
  async function run(
    key: string,
    action: () => Promise<unknown>,
    { success, focusNext }: { success?: string; focusNext?: string } = {},
  ): Promise<boolean> {
    setBusy((current) => new Set(current).add(key));
    let ok = false;
    try {
      await action();
      ok = true;
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
    return ok;
  }

  /** What a Show button did to the question that was already on screen, if any. */
  const replacedNote = (action: ModeratorAction) =>
    !dashboard?.displayed
      ? ""
      : action === "display"
        ? " The one before it is marked answered."
        : action === "rollback"
          ? " The one before it went back to its list."
          : "";

  const act = (id: string, action: ModeratorAction, success = SUCCESS_MESSAGES[action] + replacedNote(action)) =>
    run(`question:${id}`, () => moderatorApi.act(id, action), {
      success,
      focusNext: LEAVES_LIST.includes(action) ? neighbourOf(id) : undefined,
    });
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

  const { pending, awaitingHost, ready, displayed, previous, answered, rejected } = dashboard;
  const queued = [...pending, ...awaitingHost, ...ready];
  const counts: Record<string, number> = {};
  for (const q of queued) counts[q.category.slug] = (counts[q.category.slug] ?? 0) + 1;
  const visible = (list: ModeratorQuestion[]) =>
    categoryFilter === ALL_CATEGORIES ? list : list.filter((q) => q.category.slug === categoryFilter);
  const shown = { pending: visible(pending), awaitingHost: visible(awaitingHost), ready: visible(ready) };
  const shownAnswered = visible(answered);
  const shownRejected = visible(rejected);
  const isNew = (q: ModeratorQuestion) => now - new Date(q.createdAt).getTime() < NEW_FOR_MS;

  return (
    <div className={`${styles.page} ${questionFont.variable}`}>
      <header className={styles.topbar}>
        <Wordmark size={32} titleAs="h1" />
        <ConnectionBadge status={connection} />
        <div className={styles.account}>
          <span className={styles.user}>
            Moderating as <strong>{auth.user.username}</strong>
          </span>
          <button className="btn btn-quiet btn-sm" onClick={auth.logout}>
            Log out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <EventControls
          status={eventStatus}
          dashboard={dashboard}
          busy={eventBusy}
          onToggleSubmissions={() =>
            eventStatus?.paused
              ? void run("event", moderatorApi.resume, { success: "Questions are open again" })
              : void run("event", moderatorApi.pause, { success: "Questions paused" })
          }
          onClearScreen={() => displayed && act(displayed.id, "remove")}
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
                    disabled={isBusy(displayed.id)}
                  >
                    Mark answered
                  </button>
                  <button
                    className="btn btn-quiet"
                    onClick={() =>
                      act(
                        displayed.id,
                        "remove",
                        displayed.hostApprovedAt ? "Returned to Ready" : "Returned to the host queue",
                      )
                    }
                    disabled={isBusy(displayed.id)}
                  >
                    {displayed.hostApprovedAt ? "Return to ready category" : "Return to host queue"}
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">The projector shows the event logo. Press Show on screen on any question to put it up.</p>
            )}
            {/* The two kinds of Show differ in what happens to the question already up: say it once, here. */}
            {displayed && (
              <p className={styles.note}>
                Showing another question marks this one answered. Show again (from Answered) sends it back to its list.
              </p>
            )}
          </div>

          <div className={`panel ${styles.previous}`}>
            <h2 className="panel-title">Previous question</h2>
            {previous ? (
              <>
                <CategoryTag category={previous.category} />
                <p className={styles.content}>{previous.content}</p>
                <div className={styles.previousMeta}>
                  <Author name={previous.displayName} />
                  <p className={styles.note}>Answered at {formatTime(previous.answeredAt)}</p>
                </div>
                <div className={styles.actions}>
                  <button
                    className="btn btn-sm btn-quiet"
                    onClick={() => act(previous.id, "rollback")}
                    disabled={isBusy(previous.id)}
                  >
                    Show again
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Answered questions appear here, so you can bring one back.</p>
            )}
          </div>
        </section>

        <CategoryFilter
          categories={CATEGORIES}
          counts={counts}
          total={queued.length}
          selected={categoryFilter}
          onSelect={selectCategory}
        />

        <section className={styles.columns}>
          <Column
            title="1. To review"
            hint="Read each one, then send it to the host or reject it."
            count={shown.pending.length}
            total={pending.length}
            attention={pending.length > 0}
            empty={pending.length ? "No questions in this category." : "No new questions. They appear here instantly."}
          >
            <SortableList
              items={shown.pending}
              disabled={busy.has("reorder:pending")}
              onReorder={(ids) => reorder("pending", ids)}
              renderItem={(q, controls) => (
                <QuestionCard
                  question={q}
                  column="pending"
                  controls={controls}
                  isNew={isNew(q)}
                  busy={isBusy(q.id)}
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
                  <button
                    className={`btn btn-sm btn-quiet ${styles.skipAction}`}
                    onClick={() => act(q.id, "display")}
                    disabled={isBusy(q.id)}
                  >
                    Show on screen
                  </button>
                </QuestionCard>
              )}
            />
          </Column>

          <Column
            title="2. With host"
            hint="The host is deciding on the top one."
            count={shown.awaitingHost.length}
            total={awaitingHost.length}
            empty={awaitingHost.length ? "No questions in this category." : "Nothing waiting for the host."}
          >
            <SortableList
              items={shown.awaitingHost}
              disabled={busy.has("reorder:awaitingHost")}
              onReorder={(ids) => reorder("awaitingHost", ids)}
              renderItem={(q, controls) => {
                const place = awaitingHost.findIndex((other) => other.id === q.id);
                return (
                  <QuestionCard
                    question={q}
                    column="awaitingHost"
                    controls={controls}
                    busy={isBusy(q.id)}
                    note={
                      place === 0 ? (
                        <span className={styles.hostPill}>Host is reviewing</span>
                      ) : (
                        `#${place + 1} in the host's queue`
                      )
                    }
                  >
                    <button
                      className="btn btn-sm btn-quiet"
                      onClick={() => act(q.id, "display")}
                      disabled={isBusy(q.id)}
                    >
                      Show on screen
                    </button>
                    <button className="btn btn-sm btn-quiet" onClick={() => act(q.id, "review")} disabled={isBusy(q.id)}>
                      Return to review
                    </button>
                  </QuestionCard>
                );
              }}
            />
          </Column>

          <Column
            title="3. Ready"
            hint="Approved. Show one when the speakers are free."
            count={shown.ready.length}
            total={ready.length}
            empty={ready.length ? "No questions in this category." : "Questions the host approves land here."}
          >
            <SortableList
              items={shown.ready}
              disabled={busy.has("reorder:ready")}
              onReorder={(ids) => reorder("ready", ids)}
              renderItem={(q, controls) => (
                <QuestionCard
                  question={q}
                  column="ready"
                  controls={controls}
                  busy={isBusy(q.id)}
                >
                  <button className="btn btn-sm btn-lapis" onClick={() => act(q.id, "display")} disabled={isBusy(q.id)}>
                    Show on screen
                  </button>
                  <button className="btn btn-sm btn-quiet" onClick={() => act(q.id, "review")} disabled={isBusy(q.id)}>
                    Return to review
                  </button>
                </QuestionCard>
              )}
            />
          </Column>
        </section>

        <section className={styles.history}>
          <HistoryPanel
            id="answered"
            title="Answered"
            hint="Already shown, most recent first"
            count={shownAnswered.length}
            total={answered.length}
            empty={answered.length ? "No questions in this category." : "Questions marked answered appear here."}
          >
            {shownAnswered.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                column="answered"
                busy={isBusy(q.id)}
                note={`Answered at ${formatTime(q.answeredAt)}`}
              >
                <button className="btn btn-sm btn-quiet" onClick={() => act(q.id, "rollback")} disabled={isBusy(q.id)}>
                  Show again
                </button>
                <button className="btn btn-sm btn-quiet" onClick={() => act(q.id, "review")} disabled={isBusy(q.id)}>
                  Return to review
                </button>
              </QuestionCard>
            ))}
          </HistoryPanel>

          <HistoryPanel
            id="rejected"
            title="Rejected"
            hint="Never shown on screen, most recent first"
            count={shownRejected.length}
            total={rejected.length}
            empty={
              rejected.length ? "No questions in this category." : "Rejected questions appear here, so you can undo a rejection."
            }
          >
            {shownRejected.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                column="rejected"
                busy={isBusy(q.id)}
                note={
                  q.hostRejectedAt
                    ? `Rejected by the host at ${formatTime(q.hostRejectedAt)}`
                    : `Rejected at ${formatTime(q.moderatorRejectedAt)}`
                }
              >
                <button className="btn btn-sm btn-quiet" onClick={() => act(q.id, "review")} disabled={isBusy(q.id)}>
                  Return to review
                </button>
              </QuestionCard>
            ))}
          </HistoryPanel>
        </section>
      </main>

      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

/** Whether a history list is expanded, remembered per browser (a convenience: it may be unavailable). */
function readExpanded(id: string) {
  try {
    return window.localStorage.getItem(`mt:moderator:${id}-open`) === "1";
  } catch {
    return false;
  }
}

function writeExpanded(id: string, open: boolean) {
  try {
    window.localStorage.setItem(`mt:moderator:${id}-open`, open ? "1" : "0");
  } catch {
    // Private mode or blocked storage: the list just starts collapsed next time.
  }
}

/** The topic filter lives in the URL (?topic=…), so a reload keeps it. Unknown topics fall back to all. */
function readTopicFromUrl() {
  if (typeof window === "undefined") return ALL_CATEGORIES;
  const topic = new URLSearchParams(window.location.search).get("topic");
  return topic && CATEGORIES.some((c) => c.slug === topic) ? topic : ALL_CATEGORIES;
}

function writeTopicToUrl(slug: string) {
  const url = new URL(window.location.href);
  if (slug === ALL_CATEGORIES) url.searchParams.delete("topic");
  else url.searchParams.set("topic", slug);
  window.history.replaceState(window.history.state, "", url);
}

/**
 * A collapsible list (Answered, Rejected); collapsed by default so the working
 * lists stay in view. The heading holds a disclosure button, so it stays a
 * real heading for screen readers.
 */
function HistoryPanel({
  id,
  title,
  hint,
  count,
  total,
  empty,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  count: number;
  total: number;
  empty: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" && readExpanded(id));
  const toggle = () => {
    setOpen(!open);
    writeExpanded(id, !open);
  };
  return (
    <section className={`panel ${styles.column} ${styles.historyPanel}`} data-open={open || undefined}>
      <div className={styles.columnHeader}>
        <h2 className="panel-title">
          <button
            type="button"
            className={styles.historyToggle}
            aria-expanded={open}
            aria-controls={`${id}-list`}
            onClick={toggle}
          >
            <span className={styles.chevron} aria-hidden /> {title}
          </button>
        </h2>
        <span className={styles.count}>
          {count}
          {count !== total && <span className={styles.totalCount}>/{total}</span>}
        </span>
        <p className={styles.columnHint}>{hint}</p>
      </div>
      <div id={`${id}-list`} className={styles.list} hidden={!open}>
        {count === 0 ? <p className={styles.empty}>{empty}</p> : children}
      </div>
    </section>
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
      <div className={styles.list}>{count === 0 ? <p className={styles.empty}>{empty}</p> : children}</div>
    </div>
  );
}
