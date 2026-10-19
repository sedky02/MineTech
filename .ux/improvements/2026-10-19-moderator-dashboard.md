---
date: 2026-10-19
source: .ux/audits/2026-10-19-moderator-dashboard.md
scope: Moderator dashboard (/moderator)
---

# UX improvements — Moderator dashboard

## Done

| Audit # | Change | Files | Check |
| --- | --- | --- | --- |
| 1 (Critical) | **All keyboard shortcuts removed** (user decision: entirely, not just To review). The letter keys `A`/`R`/`S` and `Alt+↑/↓` are gone, cards are no longer focusable, and the keyboard hint line is removed. After an action, focus moves to the next card's first enabled button, so keyboard users keep their place. The ▲/▼ buttons and drag-and-drop stay. | `components/moderator/QuestionCard.tsx`, `SortableList.tsx`, `Dashboard.tsx`, `moderator.module.css` (`.shortcuts` removed) | No `onKeyDown`/`tabIndex` left on cards; lint + typecheck + build pass |
| 5 (Minor) | **Remove from screen is back on the On screen panel** as **"Return to ready category"** (user decision). If the question skipped the host (no `hostApprovedAt`), it doesn't go back to Ready but to the host's queue, so the label says **"Return to host queue"** instead. The toast now says "Taken off screen and back in its list". | `Dashboard.tsx` | Label follows `statusBeforeDisplay` in `backend/src/questions/questions.service.ts` |
| 3 (Major) | **Pause button contrast**: `.btn-gold` now uses near-black text without a text shadow. **2.59:1 → 7.88:1.** | `app/globals.css` | Recomputed from the tokens |
| 4 (Minor) | **Rejected hint** corrected from "Never shown to the host or the screen" to "Never shown on screen, most recent first". | `Dashboard.tsx` | — |
| 7 (Minor) | **Toast "×"** is now at least 32×32px. | `moderator.module.css` (`.toastClose`) | CSS only; not measured live |

SPEC.md §5 was updated to match (no keyboard shortcuts; where Remove lives now).

## Open — needs a decision

- **#2, the Show buttons behave differently** (Major). "Show now", "Show now (skip host)" and "Show on screen" mark the current question answered; "Show again" sends it back to its list. Proposed: when something is on screen, every Show button says what happens to it ("Show (current → answered)" or "Show again (current → back to its list)"), and the toast says it too. This is a copy and labelling decision, so it's left for the user.
- **#6, the category filter skips Answered/Rejected** (Minor). Either filter those lists too, or label the filter "working lists only". Product call.

## Deferred

- **#8, heading inside `<summary>`** (Polish, unverified). Needs a screen-reader check before changing anything.
- **Live verification.** Nothing was checked in a running browser: the user's dev servers and database are off-limits for automated runs. Worth a manual click-through: work a card with only the keyboard (Tab → button → Enter, focus should land on the next card's first button), use Return to ready category on a Ready question and on a "Show now" question, and look at the Pause button.

## 2026-10-20 — second pass ("fix all", with frontend-design applied)

Closed everything left open above, plus the moderator findings from the web-design-guidelines review:

| Source | Change | Files |
| --- | --- | --- |
| Audit #2 | Every Show button is now **"Show on screen"** (To review, With host, Ready); "Show again" names the one that behaves differently (Previous panel's "Roll back to this" renamed to match). While a question is live, the On screen panel explains both behaviours in one line, and the toast says what happened to the question that was up ("Shown on screen. The one before it is marked answered." / "Shown again. The one before it went back to its list."). Hover-only `title` tooltips removed. | `Dashboard.tsx` |
| Audit #6 | The category filter now applies to Answered and Rejected too, with `n/total` counts and a "No questions in this category." empty state. | `Dashboard.tsx`, `CategoryFilter.tsx` (doc) |
| Audit #8 | History panels no longer put an `<h2>` inside `<summary>`: the heading now contains a disclosure `<button aria-expanded aria-controls>`, and the list uses `hidden`. | `Dashboard.tsx`, `moderator.module.css` |
| WIG: landmarks | Moderator page has a `<main>` landmark and an `<h1>` (the wordmark). | `Dashboard.tsx`, `moderator.module.css` (`.main`) |
| WIG: state in URL | The topic filter is kept in `?topic=` (validated against the topic list), so a reload keeps it. | `Dashboard.tsx` |
| WIG: large lists | History cards use `content-visibility: auto` (only those: the working lists' drop indicators sit outside the card and would be clipped). | `moderator.module.css` |
| WIG: hover state | The history toggles have a hover state (gold). | `moderator.module.css` |
| WIG: drag | Text selection is off while a card is being dragged. | `SortableList.tsx`, `moderator.module.css` |

Not done, on purpose: `inert` on the dragged card (it can cancel the native drag in some browsers); expanded/collapsed history state stays in localStorage rather than the URL (it's a per-viewer convenience).

Still unverified in a browser (dev servers and database are off-limits for automated runs).
