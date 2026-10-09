import Image from "next/image";
import { EVENT_NAME } from "@/lib/config";
import styles from "./ui.module.css";

/** public/MineTechLogo.svg is 866.73 × 172.28: about 5:1. */
const WORDMARK_RATIO = 866.73 / 172.28;

/**
 * The square grass-block icon. Used where a wide wordmark can't fit
 * (favicon, loading and empty states, the "sent" confirmation).
 */
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

/**
 * The MINETECH wordmark in Minecraft title style. `height` sets the intrinsic
 * size; CSS may scale it (keep `height: auto` so the 5:1 shape is preserved).
 */
export function WordmarkLogo({ height, className }: { height: number; className?: string }) {
  return (
    <Image
      src="/MineTechLogo.svg"
      alt="MineTech"
      width={Math.round(height * WORDMARK_RATIO)}
      height={height}
      className={`${styles.wordmarkLogo} ${className ?? ""}`}
      unoptimized
      priority
    />
  );
}

/** Page header brand: the wordmark, with an optional line under it. */
export function Wordmark({
  size = 40,
  subtitle,
  titleAs: Title = "div",
}: {
  /** Wordmark height in px. */
  size?: number;
  subtitle?: string;
  /** "h1" on pages where the event name is the page's main heading. */
  titleAs?: "div" | "h1";
}) {
  return (
    <div className={styles.wordmark}>
      <Title className={styles.wordmarkTitle}>
        <WordmarkLogo height={size} />
      </Title>
      {subtitle && <div className={styles.wordmarkSubtitle}>{subtitle}</div>}
    </div>
  );
}
