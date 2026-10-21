"use client";

import { Google_Sans } from "next/font/google";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { ClubCredit, WordmarkLogo } from "@/components/ui/Logo";
import { useSocket } from "@/hooks/useSocket";
import { publicApi } from "@/lib/api/endpoints";
import type { PublicQuestion } from "@/lib/api/types";
import { EVENT_NAME } from "@/lib/config";
import { SocketEvent } from "@/lib/socket/events";
import styles from "./presentation.module.css";

/**
 * Google Sans (the GDG lockup's typeface) for the projected question: a clean
 * reading face for long text at the back of the room, with accented letters.
 * Loaded here so only the presentation route downloads it.
 */
const questionFont = Google_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-question",
  display: "swap",
});

const CURSOR_HIDE_MS = 2500;
/** How long a cleared question stays mounted to animate out: a little longer than the 240ms CSS exit. */
const EXIT_MS = 280;

/** Where students open the question form, shown under the projected question. */
const ASK_URL = "https://minetech-gdgc.vercel.app/";

/**
 * Keeps the last question mounted for a moment after it clears, so it can
 * animate out instead of vanishing. `shown` is the question to render and
 * `leaving` is true while it exits. A new question replaces it immediately.
 */
function useDepartingQuestion(question: PublicQuestion | null) {
  const [shown, setShown] = useState<PublicQuestion | null>(question);
  const [leaving, setLeaving] = useState(false);
  const [previous, setPrevious] = useState(question);

  // Reacting to a changed value while rendering (rather than in an effect)
  // means no frame is ever painted with the old output.
  if (question !== previous) {
    setPrevious(question);
    if (question) {
      setShown(question);
      setLeaving(false);
    } else if (shown) {
      setLeaving(true);
    }
  }

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  return { shown, leaving };
}

/** Bigger text for shorter questions so everything stays readable from the back row. */
function sizeFor(length: number) {
  if (length <= 80) return "xl";
  if (length <= 180) return "lg";
  if (length <= 320) return "md";
  return "sm";
}

/**
 * Full-screen projector view (SPEC §7). No visible controls: double-click or
 * press F to toggle fullscreen.
 */
export function PresentationScreen() {
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [cursorHidden, setCursorHidden] = useState(false);
  const { shown, leaving } = useDepartingQuestion(question);
  // Bumped on every socket event so an older REST response can't overwrite newer state.
  const version = useRef(0);

  const refresh = useCallback(async () => {
    const started = version.current;
    try {
      const result = await publicApi.presentationCurrent();
      if (version.current === started) setQuestion(result.question);
    } catch {
      // Keep showing what we have; the next sync will retry.
    }
  }, []);

  const connection = useSocket({
    kind: "presentation",
    onSync: refresh,
    onEvent: (event, payload) => {
      version.current++;
      if (event === SocketEvent.QUESTION_DISPLAYED) {
        setQuestion(payload as PublicQuestion);
      } else if (event === SocketEvent.QUESTION_REMOVED || event === SocketEvent.QUESTION_ANSWERED) {
        const { id } = payload as { id: string };
        setQuestion((current) => (current?.id === id ? null : current));
      }
    },
  });

  useEffect(() => {
    const toggleFullscreen = () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => undefined);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const onMove = () => {
      setCursorHidden(false);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setCursorHidden(true), CURSOR_HIDE_MS);
    };
    window.addEventListener("dblclick", toggleFullscreen);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("dblclick", toggleFullscreen);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMove);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <main className={`${styles.screen} ${questionFont.variable}`} data-cursor-hidden={cursorHidden}>

      {/* Back to the question form. Fades out with the cursor, so it disappears on the projector. */}
      <Link href="/" className={`btn btn-quiet ${styles.back}`} aria-label="Back to ask a question" title="Ask a question">
        <svg viewBox="0 0 8 7" width="24" height="21" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
          <path d="M3 0h1v7H3zM2 1h1v5H2zM1 2h1v3H1zM0 3h1v1H0zM4 2h4v3H4z" />
        </svg>
      </Link>

      {/* The card stays mounted while it animates out; the idle logo fades in underneath it. */}
      {shown && (
        <div className={styles.stage}>
          <section
            key={shown.id}
            className={`${styles.question} ${leaving ? styles.leaving : ""}`}
            aria-live="polite"
            aria-hidden={leaving || undefined}
          >
            <div className={styles.questionHeader}>
              <CategoryTag category={shown.category} large />
              <WordmarkLogo height={36} className={styles.brand} />
            </div>
            <p className={styles.text} data-size={sizeFor(shown.content.length)}>
              {shown.content}
            </p>
            <p className={styles.author}>{shown.displayName ?? "Anonymous"}</p>
          </section>
          {/* Stays put between questions; only fades with the card when the screen goes idle. please work deployyyyy*/}
          <p className={`${styles.cta} ${leaving ? styles.leaving : ""}`}>
            Ask your questions live here: <strong>{ASK_URL}</strong>
          </p>
        </div>
      )}

      {!question && (
        <section className={styles.idle} aria-label={EVENT_NAME}>
          <h1 className={styles.title}>
            <WordmarkLogo height={220} className={styles.titleLogo} />
          </h1>
        </section>
      )}

      {/* Organizer credit along the bottom edge, like a title screen's credits. */}
      {!question && <ClubCredit height={64} className={styles.credit} />}

      <div className={styles.ground} aria-hidden />
      {/* Tiny operator hint, only when the live connection is down. */}
      {connection !== "connected" && <span className={styles.offline} aria-hidden />}
    </main>
  );
}
