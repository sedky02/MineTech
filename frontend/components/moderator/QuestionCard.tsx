import { CategoryTag } from "@/components/ui/CategoryTag";
import type { ModeratorQuestion } from "@/lib/api/types";
import styles from "./moderator.module.css";

export function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

export function QuestionMeta({
  question,
  isNew,
  controls,
}: {
  question: ModeratorQuestion;
  isNew?: boolean;
  controls?: React.ReactNode;
}) {
  return (
    <div className={styles.meta}>
      <CategoryTag category={question.category} />
      {isNew && (
        <span className={styles.badge} data-tone="new">
          New
        </span>
      )}
      {question.source === "PRE_EVENT" && (
        <span className={styles.badge} data-tone="pre-event">
          Pre-event
        </span>
      )}
      <time className={styles.time} dateTime={question.createdAt}>
        {formatTime(question.createdAt)}
      </time>
      {controls}
    </div>
  );
}

export function Author({ name }: { name: string | null }) {
  return <p className={styles.author}>{name ? `— ${name}` : "— Anonymous"}</p>;
}

export function QuestionCard({
  question,
  children,
  note,
  controls,
  isNew,
  busy,
  column,
}: {
  question: ModeratorQuestion;
  children?: React.ReactNode;
  note?: React.ReactNode;
  /** Reorder controls, shown next to the time so the action row only holds actions. */
  controls?: React.ReactNode;
  isNew?: boolean;
  busy?: boolean;
  /** Used to move keyboard focus to the next card after an action. */
  column?: string;
}) {
  return (
    <article
      className={styles.card}
      data-question-id={question.id}
      data-column={column}
      data-busy={busy || undefined}
      aria-busy={busy || undefined}
    >
      <QuestionMeta question={question} isNew={isNew} controls={controls} />
      <p className={styles.content}>{question.content}</p>
      <Author name={question.displayName} />
      {note && <p className={styles.note}>{note}</p>}
      {children && <div className={styles.actions}>{children}</div>}
    </article>
  );
}
