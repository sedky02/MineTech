import type { EventStatus, ModeratorDashboard } from "@/lib/api/types";
import styles from "./moderator.module.css";

interface Props {
  status: EventStatus | null;
  dashboard: ModeratorDashboard;
  busy: boolean;
  onToggleSubmissions: () => void;
  onClearScreen: () => void;
}

/**
 * The control bar: a summary of the whole event on the left, routine
 * submission control in the middle, and the emergency actions set apart on
 * the right (SPEC §5).
 */
export function EventControls({ status, dashboard, busy, onToggleSubmissions, onClearScreen }: Props) {
  const state = status?.paused ? "paused" : "open";
  const stateLabel = state === "paused" ? "Questions paused" : "Questions open";

  const summary = [
    { label: "To review", value: dashboard.pending.length, attention: dashboard.pending.length > 0 },
    { label: "With host", value: dashboard.awaitingHost.length },
    { label: "Ready", value: dashboard.ready.length },
    { label: "Answered", value: dashboard.stats.answered },
    { label: "Rejected", value: dashboard.stats.rejected },
  ];

  return (
    <section className={`panel ${styles.controlBar}`} aria-label="Event controls">
      <dl className={styles.summary}>
        {summary.map((item) => (
          <div key={item.label} className={styles.summaryItem} data-attention={item.attention || undefined}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.submissions}>
        <span className={styles.submissionState} data-state={state}>
          {stateLabel}
        </span>
        <button
          type="button"
          className={`btn btn-sm ${status?.paused ? "btn-primary" : "btn-gold"}`}
          onClick={onToggleSubmissions}
          disabled={busy || !status}
        >
          {status?.paused ? "Resume questions" : "Pause questions"}
        </button>
      </div>

      <div className={styles.danger} role="group" aria-label="Emergency actions">
        <button
          type="button"
          className="btn btn-sm btn-quiet"
          onClick={onClearScreen}
          disabled={busy || !dashboard.displayed}
          title="Shows the event logo on the projector"
        >
          Clear screen
        </button>
      </div>
    </section>
  );
}
