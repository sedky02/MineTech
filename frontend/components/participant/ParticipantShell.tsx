"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { WordmarkLogo } from "@/components/ui/Logo";
import styles from "./participant.module.css";

/** The logo stays centred at least this long, so it registers before it moves. */
const MIN_SPLASH_MS = 600;
/** After this long, explain that the server may be waking up. */
const SLOW_LOAD_MS = 4_000;
/** The logo's trip to its place: Apple's sheet curve, eases in and settles without overshoot. */
const MORPH_MS = 700;
const MORPH_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";
const SPLASH_LOGO_HEIGHT = 96;

type Phase = "loading" | "morphing" | "done";

interface BootContextValue {
  phase: Phase;
  /** The page has what it needs. `instant` skips the minimum splash time (data came from the cache). */
  ready: (options?: { instant?: boolean }) => void;
}

const BootContext = createContext<BootContextValue>({ phase: "done", ready: () => undefined });

export function useBoot() {
  return useContext(BootContext);
}

/**
 * First launch: only the MineTech logo, centred, while the page loads. When the
 * form is ready the logo glides to its place in the header and the rest fades in.
 * The same logo element is measured and moved, so it lands exactly on the header's one.
 */
export function ParticipantShell({
  brand,
  footer,
  children,
}: {
  brand: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [slow, setSlow] = useState(false);

  const brandRef = useRef<HTMLDivElement>(null);
  const splashLogoRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(0);
  const requested = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    mountedAt.current = performance.now();
    const pending = timers.current;
    pending.push(setTimeout(() => setSlow(true), SLOW_LOAD_MS));
    return () => pending.forEach(clearTimeout);
  }, []);

  const morph = useCallback(() => {
    const splash = splashLogoRef.current;
    const target = brandRef.current?.querySelector("img");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!splash || !target || reduced || typeof splash.animate !== "function") {
      setPhase("done");
      return;
    }
    const from = splash.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const scale = to.width / from.width;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    setPhase("morphing");
    splash
      .animate(
        [{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }],
        { duration: MORPH_MS, easing: MORPH_EASING, fill: "forwards" },
      )
      .finished.then(
        () => setPhase("done"),
        () => setPhase("done"),
      );
  }, []);

  const ready = useCallback(
    (options?: { instant?: boolean }) => {
      if (requested.current) return;
      requested.current = true;
      const wait = options?.instant ? 0 : Math.max(0, MIN_SPLASH_MS - (performance.now() - mountedAt.current));
      timers.current.push(setTimeout(morph, wait));
    },
    [morph],
  );

  const value = useMemo(() => ({ phase, ready }), [phase, ready]);

  return (
    <BootContext.Provider value={value}>
      <main className={styles.page} data-boot={phase}>
        <header className={styles.header}>
          <div ref={brandRef} className={styles.brandSlot}>
            {brand}
          </div>
        </header>
        <div className={styles.body}>
          {children}
          {footer}
        </div>
      </main>

      {phase !== "done" && (
        <div className={styles.splash}>
          <div ref={splashLogoRef} className={styles.splashLogo} aria-hidden="true">
            <div className={styles.splashBob} data-still={phase !== "loading" || undefined}>
              <WordmarkLogo height={SPLASH_LOGO_HEIGHT} />
            </div>
          </div>
          {phase === "loading" && (
            <p className={styles.splashHint} role="status">
              {slow ? "Waking up the server, this can take up to a minute." : <span className="sr-only">Loading…</span>}
            </p>
          )}
        </div>
      )}
    </BootContext.Provider>
  );
}
