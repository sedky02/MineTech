"use client";

import { useCallback, useEffect, useState } from "react";
import { BlockSwatch } from "@/components/ui/CategoryTag";
import { ApiError } from "@/lib/api/client";
import { publicApi } from "@/lib/api/endpoints";
import type { Category, PublicEventStatus } from "@/lib/api/types";
import { DISPLAY_NAME_MAX, QUESTION_MAX, validateQuestion } from "@/lib/validation/question";
import styles from "./participant.module.css";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready" };

async function loadInitialData() {
  const [categories, eventStatus] = await Promise.all([publicApi.categories(), publicApi.eventStatus()]);
  return { categories, eventStatus };
}

export function QuestionForm() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [categories, setCategories] = useState<Category[]>([]);
  const [eventStatus, setEventStatus] = useState<PublicEventStatus>({ submissionsOpen: true });

  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const applyLoaded = useCallback((result: Awaited<ReturnType<typeof loadInitialData>>) => {
    setCategories(result.categories);
    setEventStatus(result.eventStatus);
    setLoad({ status: "ready" });
  }, []);

  const applyLoadError = useCallback((e: unknown) => {
    setLoad({ status: "error", message: e instanceof Error ? e.message : "Failed to load" });
  }, []);

  useEffect(() => {
    loadInitialData().then(applyLoaded, applyLoadError);
  }, [applyLoaded, applyLoadError]);

  const retryLoad = () => {
    setLoad({ status: "loading" });
    loadInitialData().then(applyLoaded, applyLoadError);
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateQuestion({ category, content, displayName });
    if (invalid) {
      setError(invalid);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await publicApi.submitQuestion({
        category,
        content: content.trim(),
        displayName: displayName.trim() || undefined,
      });
      // Only reached when the server confirmed the question was stored.
      setSent(true);
      setContent("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        // Paused in the meantime: refresh the banner.
        publicApi.eventStatus().then(setEventStatus).catch(() => undefined);
      }
      const serverFailed = !(e instanceof ApiError) || e.status === 0 || e.status >= 500;
      setError(serverFailed ? "Your question was NOT sent. Please try again in a moment." : e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (load.status === "loading") {
    return <p className="muted">Loading…</p>;
  }

  if (load.status === "error") {
    return (
      <div className={`alert alert-error ${styles.stack}`} role="alert">
        <p>{load.message}</p>
        <button className="btn btn-sm" onClick={retryLoad}>
          Try again
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className={`panel ${styles.confirmation}`} role="status">
        <div className={styles.confirmBlock} aria-hidden />
        <h2 className={styles.confirmTitle}>Question sent!</h2>
        <p className="muted">Thanks. Our team will review it.</p>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSent(false);
            setError(null);
          }}
        >
          Ask another question
        </button>
      </div>
    );
  }

  const trimmedLength = content.trim().length;
  const closed = !eventStatus.submissionsOpen;

  return (
    <form className={`panel ${styles.form}`} onSubmit={onSubmit} noValidate>
      {closed && (
        <div className="alert" role="status">
          Questions are paused for a moment. Try again shortly.
        </div>
      )}

      <fieldset className={styles.fieldset}>
        <legend className="field-label">1. Pick a topic</legend>
        <div className={styles.categories}>
          {categories.map((c) => (
            <label key={c.slug} className={styles.category} data-selected={category === c.slug}>
              <input
                type="radio"
                name="category"
                value={c.slug}
                checked={category === c.slug}
                onChange={() => {
                  setCategory(c.slug);
                  setError(null);
                }}
                className="sr-only"
              />
              <BlockSwatch slug={c.slug} size={18} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="content" className="field-label">
          2. Your question
          <span className="field-hint" aria-live="polite">
            {trimmedLength}/{QUESTION_MAX}
          </span>
        </label>
        <textarea
          id="content"
          className="input"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setError(null);
          }}
          maxLength={QUESTION_MAX + 20}
          placeholder="What would you like to ask the speakers?"
          required
        />
      </div>

      <div className="field">
        <label htmlFor="displayName" className="field-label">
          3. Your name <span className="field-hint">optional</span>
        </label>
        <input
          id="displayName"
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={DISPLAY_NAME_MAX}
          placeholder="Leave empty to stay anonymous"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || closed}>
        {submitting ? "Sending…" : "Send question"}
      </button>
    </form>
  );
}
