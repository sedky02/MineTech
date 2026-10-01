import { CategoryTag } from "@/components/ui/CategoryTag";
import type { ModeratorQuestion } from "@/lib/api/types";
import styles from "./moderator.module.css";

export function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

export function QuestionMeta({ question, isNew }: { question: ModeratorQuestion; isNew?: boolean }) {
  return (
    <div className={styles.meta}>
      <CategoryTag category={question.category} />
      {isNew && <span className={styles.newBadge}>New</span>}
      {question.source === "PRE_EVENT" && <span className={styles.badge}>Pre-event</span>}
      <time className={styles.time} dateTime={question.createdAt}>
        {formatTime(question.createdAt)}
      </time>
    </div>
  );
}

export function Author({ name }: { name: string | null }) {
  return <p className={styles.author}>{name ? `— ${name}` : "— Anonymous"}</p>;
}

/** Letter shortcuts (lowercase key → action) and Alt+arrow moves for a focused card. */
export interface CardShortcuts {
  keys?: Record<string, () => void>;
  up?: () => void;
  down?: () => void;
}

function handleShortcut(event: React.KeyboardEvent, shortcuts: CardShortcuts) {
  if (event.ctrlKey || event.metaKey) return;
  const action = event.altKey
    ? event.key === "ArrowUp"
      ? shortcuts.up
      : event.key === "ArrowDown"
        ? shortcuts.down
        : undefined
    : shortcuts.keys?.[event.key.toLowerCase()];
  if (!action) return;
  event.preventDefault();
  action();
}

export function QuestionCard({
  question,
  children,
  note,
  controls,
  isNew,
  busy,
  column,
  shortcuts,
}: {
  question: ModeratorQuestion;
  children?: React.ReactNode;
  note?: React.ReactNode;
  /** Reorder controls, shown at the end of the action row. */
  controls?: React.ReactNode;
  isNew?: boolean;
  busy?: boolean;
  /** Used to move keyboard focus to the next card after an action. */
  column?: string;
  shortcuts?: CardShortcuts;
}) {
  return (
    <article
      className={styles.card}
      data-question-id={question.id}
      data-column={column}
      data-busy={busy || undefined}
      aria-busy={busy || undefined}
      tabIndex={shortcuts ? 0 : undefined}
      onKeyDown={shortcuts && !busy ? (event) => handleShortcut(event, shortcuts) : undefined}
    >
      <QuestionMeta question={question} isNew={isNew} />
      <p className={styles.content}>{question.content}</p>
      <Author name={question.displayName} />
      {note && <p className={styles.note}>{note}</p>}
      {(children || controls) && (
        <div className={styles.actions}>
          {children}
          {controls}
        </div>
      )}
    </article>
  );
}
