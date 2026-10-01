import type { EventStatus } from "@/lib/api/types";
import styles from "./moderator.module.css";

interface Props {
  status: EventStatus | null;
  hasDisplayed: boolean;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onClearDisplay: () => void;
  onEnd: () => void;
}

/** Emergency controls (SPEC §5). */
export function EventControls({ status, hasDisplayed, busy, onPause, onResume, onClearDisplay, onEnd }: Props) {
  const ended = status?.ended ?? false;
  const label = ended ? "Event ended" : status?.paused ? "Submissions paused" : "Submissions open";

  return (
    <div className={styles.controls}>
      <span className={styles.submissionState} data-state={ended ? "ended" : status?.paused ? "paused" : "open"}>
        {label}
      </span>
      {status?.paused ? (
        <button className="btn btn-sm btn-primary" onClick={onResume} disabled={busy || ended}>
          Resume submissions
        </button>
      ) : (
        <button className="btn btn-sm btn-gold" onClick={onPause} disabled={busy || ended || !status}>
          Pause submissions
        </button>
      )}
      <button className="btn btn-sm" onClick={onClearDisplay} disabled={busy || !hasDisplayed}>
        Clear display
      </button>
      <button className="btn btn-sm btn-danger" onClick={onEnd} disabled={busy || ended}>
        End event
      </button>
    </div>
  );
}
