import { Logo } from "./Logo";
import styles from "./ui.module.css";

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="center-screen">
      <div className={styles.loading}>
        <Logo size={56} />
        <p className="muted">{label}</p>
      </div>
    </div>
  );
}

export function MessageScreen({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="center-screen">
      <div className={`panel ${styles.message}`}>
        <h1 className={styles.messageTitle}>{title}</h1>
        <p className="muted">{message}</p>
        {action}
      </div>
    </div>
  );
}
