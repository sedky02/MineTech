import { CategoryTag } from "@/components/ui/CategoryTag";
import type { ModeratorQuestion } from "@/lib/api/types";
import styles from "./moderator.module.css";

export function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

export function QuestionMeta({ question }: { question: ModeratorQuestion }) {
  return (
    <div className={styles.meta}>
      <CategoryTag category={question.category} />
      {question.source === "PRE_EVENT" && <span className={styles.badge}>Pre-event</span>}
      <span className={styles.time}>{formatTime(question.createdAt)}</span>
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
}: {
  question: ModeratorQuestion;
  children?: React.ReactNode;
  note?: string;
  /** Reorder controls, shown at the end of the action row. */
  controls?: React.ReactNode;
}) {
  return (
    <article className={styles.card}>
      <QuestionMeta question={question} />
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
