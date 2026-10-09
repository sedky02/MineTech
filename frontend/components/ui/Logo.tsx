import Image from "next/image";
import { EVENT_NAME } from "@/lib/config";
import styles from "./ui.module.css";

/** Replace public/logo.svg with the club logo; the rest of the UI adapts. */
export function Logo({ size = 48 }: { size?: number }) {
  return (
    <Image
      src="/logo.svg"
      alt={`${EVENT_NAME} logo`}
      width={size}
      height={size}
      className={styles.logo}
      unoptimized
      priority
    />
  );
}

export function Wordmark({
  size = 40,
  subtitle,
  titleAs: Title = "div",
}: {
  size?: number;
  subtitle?: string;
  /** "h1" on pages where the event name is the page's main heading. */
  titleAs?: "div" | "h1";
}) {
  return (
    <div className={styles.wordmark}>
      <Logo size={size} />
      <div>
        <Title className={styles.wordmarkTitle}>{EVENT_NAME}</Title>
        {subtitle && <div className={styles.wordmarkSubtitle}>{subtitle}</div>}
      </div>
    </div>
  );
}
