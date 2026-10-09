"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BlockSwatch } from "@/components/ui/CategoryTag";
import { ApiError } from "@/lib/api/client";
import { publicApi } from "@/lib/api/endpoints";
import type { Category, PublicEventStatus } from "@/lib/api/types";
import {
  DISPLAY_NAME_MAX,
  type FieldError,
  type QuestionField,
  QUESTION_MAX,
  validateQuestion,
} from "@/lib/validation/question";
import styles from "./participant.module.css";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready" };

/** While questions are paused, check this often whether the moderator reopened them. */
const PAUSE_RECHECK_MS = 10_000;
/** After this long still loading, explain that the server may be waking up. */
const SLOW_LOAD_MS = 4_000;
/** Start announcing the remaining characters this close to the limit. */
const COUNTER_ANNOUNCE_WITHIN = 50;

const ERROR_IDS: Record<QuestionField, string> = {
  category: "category-error",
  content: "content-error",
  displayName: "name-error",
};

async function loadInitialData() {
  const [categories, eventStatus] = await Promise.all([publicApi.categories(), publicApi.eventStatus()]);
  return { categories, eventStatus };
}

/** Network failures and 5xx get a plain explanation instead of the server's raw text. */
function isServerFailure(e: unknown) {
  return !(e instanceof ApiError) || e.status === 0 || e.status >= 500;
}

export function QuestionForm() {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [slowLoad, setSlowLoad] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [eventStatus, setEventStatus] = useState<PublicEventStatus>({ submissionsOpen: true });
  const [reopened, setReopened] = useState(false);

  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const firstTopicRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const askAgainRef = useRef<HTMLButtonElement>(null);
  /** Set by "Ask another question", so focus only jumps to the field then, never on first load. */
  const returningRef = useRef(false);

  const applyLoaded = useCallback((result: Awaited<ReturnType<typeof loadInitialData>>) => {
    setCategories(result.categories);
    setEventStatus(result.eventStatus);
    setLoad({ status: "ready" });
  }, []);

  const applyLoadError = useCallback((e: unknown) => {
    setLoad({
      status: "error",
      message: isServerFailure(e)
        ? "Couldn't load the form. Check your connection and try again."
        : e instanceof Error
          ? e.message
          : "Couldn't load the form.",
    });
  }, []);

  useEffect(() => {
    loadInitialData().then(applyLoaded, applyLoadError);
  }, [applyLoaded, applyLoadError]);

  // The free hosting plan can take up to a minute to wake: say so instead of a bare "Loading…".
  useEffect(() => {
    if (load.status !== "loading") return;
    const timer = setTimeout(() => setSlowLoad(true), SLOW_LOAD_MS);
    return () => clearTimeout(timer);
  }, [load.status]);

  // While paused the submit button is disabled, so the student can't trigger a recheck:
  // poll, and recheck when they come back to the tab.
  const closed = load.status === "ready" && !eventStatus.submissionsOpen;
  useEffect(() => {
    if (!closed) return;
    const recheck = () => {
      publicApi.eventStatus().then((status) => {
        setEventStatus(status);
        if (status.submissionsOpen) setReopened(true);
      }, () => undefined);
    };
    const timer = setInterval(recheck, PAUSE_RECHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") recheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [closed]);

  // Keep keyboard focus somewhere sensible when the form and the confirmation swap.
  useEffect(() => {
    if (sent) {
      askAgainRef.current?.focus();
    } else if (returningRef.current) {
      returningRef.current = false;
      contentRef.current?.focus();
    }
  }, [sent]);

  const retryLoad = () => {
    setLoad({ status: "loading" });
    setSlowLoad(false);
    loadInitialData().then(applyLoaded, applyLoadError);
  };

  function clearErrors() {
    setFieldError(null);
    setServerError(null);
  }

  function focusField(field: QuestionField) {
    const target = { category: firstTopicRef, content: contentRef, displayName: nameRef }[field].current;
    requestAnimationFrame(() => target?.focus());
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const invalid = validateQuestion({ category, content, displayName });
    if (invalid) {
      setServerError(null);
      setFieldError(invalid);
      focusField(invalid.field);
      return;
    }

    setSubmitting(true);
    clearErrors();
    setReopened(false);
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
      setServerError(
        isServerFailure(e) ? "Your question was NOT sent. Please try again in a moment." : (e as Error).message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (load.status === "loading") {
    return (
      <div className={styles.loading} role="status">
        <p className="muted">Loading…</p>
        {slowLoad && <p className="field-hint">Waking up the server, this can take up to a minute.</p>}
      </div>
    );
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
          ref={askAgainRef}
          className="btn btn-primary"
          onClick={() => {
            returningRef.current = true;
            clearErrors();
            setSent(false);
          }}
        >
          Ask another question
        </button>
      </div>
    );
  }

  const trimmedLength = content.trim().length;
  const remaining = QUESTION_MAX - trimmedLength;
  const over = remaining < 0;
  const errorFor = (field: QuestionField) =>
    fieldError?.field === field ? (
      <p id={ERROR_IDS[field]} className={styles.fieldError}>
        {fieldError.message}
      </p>
    ) : null;
  const describedBy = (field: QuestionField, ...others: string[]) =>
    [...others, fieldError?.field === field ? ERROR_IDS[field] : ""].filter(Boolean).join(" ") || undefined;

  return (
    <form className={`panel ${styles.form}`} onSubmit={onSubmit} noValidate>
      {closed && (
        <div className="alert" role="status">
          Questions are paused for a moment. This page unlocks by itself when they reopen.
        </div>
      )}
      {reopened && !closed && (
        <div className="alert alert-success" role="status">
          Questions are open again.
        </div>
      )}

      <fieldset className={styles.fieldset} aria-describedby={describedBy("category")}>
        <legend className="field-label">1. Pick a topic</legend>
        <div className={styles.categories}>
          {categories.map((c, index) => (
            <label key={c.slug} className={styles.category} data-selected={category === c.slug}>
              <input
                ref={index === 0 ? firstTopicRef : undefined}
                type="radio"
                name="category"
                value={c.slug}
                checked={category === c.slug}
                onChange={() => {
                  setCategory(c.slug);
                  clearErrors();
                }}
                className="sr-only"
              />
              <BlockSwatch slug={c.slug} size={18} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        {errorFor("category")}
      </fieldset>

      <div className="field">
        <div className="field-label">
          <label htmlFor="content">2. Your question</label>
          <span id="content-count" className={styles.counter} data-over={over || undefined}>
            {over ? `${-remaining} over the limit` : `${trimmedLength}/${QUESTION_MAX}`}
          </span>
        </div>
        <textarea
          ref={contentRef}
          id="content"
          className="input"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            clearErrors();
          }}
          maxLength={QUESTION_MAX + 20}
          placeholder="What would you like to ask the speakers?"
          aria-invalid={fieldError?.field === "content" || over || undefined}
          aria-describedby={describedBy("content", "content-count")}
          required
        />
        {/* Announced only near the limit, so screen readers aren't read the count on every keystroke. */}
        <span className="sr-only" aria-live="polite">
          {remaining <= COUNTER_ANNOUNCE_WITHIN
            ? over
              ? `${-remaining} characters over the limit`
              : `${remaining} characters left`
            : ""}
        </span>
        {errorFor("content")}
      </div>

      <div className="field">
        <label htmlFor="displayName" className="field-label">
          3. Your name
        </label>
        <p id="name-hint" className={`field-hint ${styles.hint}`}>
          Optional. Leave it empty to stay anonymous.
        </p>
        <input
          ref={nameRef}
          id="displayName"
          className="input"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            clearErrors();
          }}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="off"
          aria-invalid={fieldError?.field === "displayName" || undefined}
          aria-describedby={describedBy("displayName", "name-hint")}
        />
        {errorFor("displayName")}
      </div>

      {serverError && (
        <div className="alert alert-error" role="alert">
          {serverError}
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || closed}>
        {submitting ? "Sending…" : "Send question"}
      </button>
    </form>
  );
}
