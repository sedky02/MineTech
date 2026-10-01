"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CategoryTag } from "@/components/ui/CategoryTag";
import { Logo } from "@/components/ui/Logo";
import { useSocket } from "@/hooks/useSocket";
import { publicApi } from "@/lib/api/endpoints";
import type { PublicQuestion } from "@/lib/api/types";
import { CLUB_NAME, EVENT_NAME } from "@/lib/config";
import { SocketEvent } from "@/lib/socket/events";
import styles from "./presentation.module.css";

const PARTICIPANT_URL = process.env.NEXT_PUBLIC_PARTICIPANT_URL ?? "";
const CURSOR_HIDE_MS = 2500;

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
      } else if (event === SocketEvent.EVENT_ENDED) {
        setQuestion(null);
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
    <main className={styles.screen} data-cursor-hidden={cursorHidden}>
      <div className={styles.stars} aria-hidden />

      {question ? (
        <section key={question.id} className={styles.question} aria-live="polite">
          <div className={styles.questionHeader}>
            <CategoryTag category={question.category} large />
            <div className={styles.brand}>
              <Logo size={40} />
              <span>{EVENT_NAME}</span>
            </div>
          </div>
          <p className={styles.text} data-size={sizeFor(question.content.length)}>
            {question.content}
          </p>
          <p className={styles.author}>{question.displayName ?? "Anonymous"}</p>
        </section>
      ) : (
        <section className={styles.idle} aria-label={EVENT_NAME}>
          <Logo size={220} />
          <h1 className={styles.title}>{EVENT_NAME}</h1>
          {CLUB_NAME && <p className={styles.club}>{CLUB_NAME}</p>}
          {PARTICIPANT_URL && (
            <p className={styles.cta}>
              Ask your questions at <strong>{PARTICIPANT_URL}</strong>
            </p>
          )}
        </section>
      )}

      <div className={styles.ground} aria-hidden />
      {/* Tiny operator hint, only when the live connection is down. */}
      {connection !== "connected" && <span className={styles.offline} aria-hidden />}
    </main>
  );
}
