import type { ConnectionStatus } from "@/hooks/useSocket";
import styles from "./ui.module.css";

const LABELS: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  connected: "Live",
  reconnecting: "Reconnecting…",
  unauthorized: "Session expired",
};

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={styles.connection} data-status={status} role="status">
      <span className={styles.connectionDot} aria-hidden />
      {LABELS[status]}
    </span>
  );
}
