import Image from "next/image";
import { EVENT_NAME } from "@/lib/config";
import styles from "./ui.module.css";

/** public/MineTechLogo.svg is 866.73 × 172.28: about 5:1. */
const WORDMARK_RATIO = 866.73 / 172.28;
/** public/GDGC-White.svg is 1008.3 × 122.66: about 8:1. */
const CLUB_LOGO_RATIO = 1008.3 / 122.66;

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

/**
 * The organising club's lockup ("Google Developer Group · GDG on Campus
 * ISSATSo"), white version for the dark theme. Its second line is ~30% of the
 * height, so keep it at least ~40px tall to stay readable.
 */
export function ClubLogo({ height, className }: { height: number; className?: string }) {
  return (
    <Image
      src="/GDGC-White.svg"
      alt="Google Developer Group on Campus ISSATSo"
      width={Math.round(height * CLUB_LOGO_RATIO)}
      height={height}
      className={`${styles.wordmarkLogo} ${className ?? ""}`}
      unoptimized
    />
  );
}

/**
 * "Organized by" credit with the club lockup. Like the credits on Minecraft's
 * title screen, it sits at the bottom, under the event's own brand and content.
 */
export function ClubCredit({ height, className }: { height: number; className?: string }) {
  return (
    <div className={`${styles.credit} ${className ?? ""}`}>
      <span className={styles.creditLabel}>Organized by</span>
      <ClubLogo height={height} />
    </div>
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
  subtitle?: React.ReactNode;
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
