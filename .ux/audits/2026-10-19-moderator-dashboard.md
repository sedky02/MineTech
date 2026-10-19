---
date: 2026-10-19
scope: Moderator dashboard (/moderator) — frontend/app/moderator/page.tsx and the components it renders (components/moderator/*), including the Answered/Rejected lists and "Show now" added the same day
mode: static (source read only; nothing was run in a browser)
---

# UX audit — Moderator dashboard

## Executive summary

The dashboard is in good shape for its job: undo paths now exist for every routine action (Rejected → Return to review, Answered → Show again / Return to review), only the card being acted on is disabled, every action confirms with a toast, and nearly all text meets WCAG AA contrast. The real risks are **error prevention around the projector**: a single click or the `S` key on a "To review" card now puts an unread student question on the screen in front of the audience, and the different "Show" buttons don't behave the same way when something is already on screen. Fix finding 1 before the event; the rest can follow. **Go, with finding 1 addressed.**

All findings are from reading the source. Anything about runtime behaviour is marked **potential — unverified**; contrast values were computed from the CSS colour tokens.

## Findings

| # | Severity | Framework | Summary | Location |
| --- | --- | --- | --- | --- |
| 1 | 1 — Critical | Nielsen #5 Error prevention (Shneiderman: easy reversal) | One click or `S` on a "To review" card projects an unreviewed question, next to "Send to host" and the `A`/`R` keys | `components/moderator/Dashboard.tsx:290-304` |
| 2 | 2 — Major | Nielsen #4 Consistency & standards (Shneiderman: consistency) | Four "Show" buttons, two different side effects on the current question, explained only in a hover tooltip or not at all | `Dashboard.tsx:161, 239, 304, 351, 379, 407` |
| 3 | 2 — Major | WCAG 2.2 SC 1.4.3 Contrast (Minimum) | "Pause questions" label is white on `#c99a1d`: **2.59:1** (needs 4.5:1 at 15px) | `EventControls.tsx:46`, `app/globals.css` `.btn-gold` |
| 4 | 3 — Minor | Nielsen #2 Match with the real world | Rejected list hint says "Never shown to the host or the screen", but host-rejected questions were shown to the host | `Dashboard.tsx:421` |
| 5 | 3 — Minor | Fitts's Law / Nielsen #6 Recognition over recall | Taking a question off screen without answering it now means finding "Clear screen" in the top bar, away from the On screen panel | `Dashboard.tsx:203-225`, `EventControls.tsx:54-63` |
| 6 | 3 — Minor | Nielsen #4 Consistency | The category filter doesn't apply to the Answered/Rejected lists, with no sign that it doesn't | `Dashboard.tsx` (history section), `CategoryFilter.tsx` |
| 7 | 3 — Minor | WCAG 2.2 SC 2.5.8 Target Size (Minimum) — potential, unverified | Toast "×" dismiss button may be narrower than 24px | `moderator.module.css:343` |
| 8 | 4 — Polish | WCAG 1.3.1 Info & relationships — potential, unverified | `<h2>` inside `<summary>`: some screen readers drop the heading semantics inside the summary's button role | `Dashboard.tsx:494-495` |

## Detailed findings

### 1. One click projects an unreviewed question — Critical

**What's wrong.** Each "To review" card has **Show now** (`Dashboard.tsx:298-305`), and the `S` key on a focused card does the same (`:290`). The question goes straight to the projector with no confirmation. These are questions nobody has read yet: the moderator is working through them with the keyboard shortcuts `A` (send to host) and `R` (reject), and `S` sits right next to both on the keyboard. Focus also jumps to the next card after every action (`LEAVES_LIST`), so a slip of the finger lands on a card the moderator hasn't read yet.

**Frameworks.** Nielsen #5 (error prevention). Corroborated by Shneiderman's "permit easy reversal": the action can be undone (Clear screen), but by then the audience has already seen it. The project already removed "End event" after it was triggered by accident in production (SPEC §5), so the cost of accidental clicks is known to be real here.

**Evidence.** Static: `shortcuts.keys.s` on the pending card (`Dashboard.tsx:290`), and the `display` action is in `LEAVES_LIST`, so focus advances afterwards. The backend accepts `PENDING → DISPLAYED` (`questions.service.ts`, `DISPLAYABLE`).

**Fix.** Any one of these, strongest first:
- Drop the `s` shortcut from the To review card only; keep the button.
- Make **Show now** on To review a two-step action: the first click turns the button into "Confirm: show on screen" for about 3 seconds.
- Give the button less visual weight than "Send to host" (for example `btn-quiet`), and show the question text in the success toast so a wrong pick is obvious at once.

### 2. "Show" buttons behave differently when something is on screen — Major

**What's wrong.** Four buttons put a question on screen:

- "Show now" (To review)
- "Show now (skip host)" (With host)
- "Show on screen / Show (replaces current)" (Ready)
- "Show again" (Answered)

The first three mark the current question **answered** (`display`). "Show again" sends the current question **back to its list** (`rollback`). The difference is only in a `title` tooltip on "Show again" (`:407`), which keyboard and touch users never see. Of the first three, only the Ready button says "replaces current" (`:161`).

**Frameworks.** Nielsen #4 (consistency) and #1 (visibility of system status). Shneiderman: consistency, and offer informative feedback.

**Evidence.** Static: `display()` versus `rollback()` in `backend/src/questions/questions.service.ts`; labels at `Dashboard.tsx:161, 304, 351, 379, 409`.

**Fix.** When `displayed` is set, give every Show button the same suffix and say what happens to the current question. For example "Show (current → answered)" on the display buttons and "Show again (current → back to its list)" on Answered. Or put one line under the On screen panel: "Showing another question marks this one answered." Also put the consequence in the success toast ("On screen now — previous question marked answered").

### 3. "Pause questions" fails text contrast — Major

**What's wrong.** The Pause button uses `btn-gold` (`#c99a1d`) with white 15px/600 text. Contrast is **2.59:1**. AA needs 4.5:1 below 18.66px bold, and the text shadow doesn't count toward the ratio. This is one of the two routine event controls.

**Framework.** WCAG 2.2 SC 1.4.3 (AA).

**Evidence.** Computed from the tokens: `#ffffff` on `#c99a1d` = 2.59:1. For reference, the other buttons pass: lapis 5.51:1, grass-dark 5.04:1, stone 4.74:1.

**Fix.** Use dark text on the gold button (`color: var(--outline)` and `text-shadow: none`; `#050506` on `#c99a1d` is about 8:1), or darken the background to about `#8a6a10` to keep white text.

### 4. Rejected list hint is wrong for host rejections — Minor

**What's wrong.** The Rejected panel hint reads "Never shown to the host or the screen" (`Dashboard.tsx:421`). Questions the host rejected *were* shown to the host. That's how they got rejected, and the cards even say "Rejected by the host at …".

**Framework.** Nielsen #2 (match between the system and the real world): the label states something false.

**Fix.** "Never shown on screen" or "Rejected by you or the host, most recent first".

### 5. Off-screen-without-answering is now far from the question — Minor

**What's wrong.** The On screen panel's "Remove from screen" button was removed (at the user's request, 2026-10-19). The only way to take a question down without marking it answered is now **Clear screen**, in the "Emergency actions" group on the far right of the control bar. A moderator looking at the On screen panel sees only "Mark answered", which is the wrong action when a question was shown by mistake: it lands in Answered and becomes the "Previous question".

**Frameworks.** Fitts's Law (the target is far from where attention is). Nielsen #6 (recognition rather than recall): the moderator has to remember that Clear screen exists.

**Evidence.** Static: `Dashboard.tsx` On screen panel only renders "Mark answered". `EventControls.tsx:54-63` has Clear screen.

**Fix.** Keep the decision, but add a short hint in the On screen panel: "Shown by mistake? Use **Clear screen** (top bar) to send it back to its list." Or make Clear screen's tooltip text visible next to the button.

### 6. Category filter silently skips the history lists — Minor

**What's wrong.** Picking a topic chip filters To review, With host and Ready, but the Answered and Rejected lists keep showing every topic. The chip group is labelled "Filter questions by category", which reads as page-wide.

**Framework.** Nielsen #4 (consistency).

**Fix.** Either apply the same filter to both history lists, or add "(working lists only)" to the filter's label or hint.

### 7. Toast dismiss button may be under 24px wide — Minor, potential, unverified

**What's wrong.** `.toastClose` has no width or min-size: it's a "×" glyph at 22px with `padding: 0 4px` (`moderator.module.css:343-351`). Its width is likely around 20px, under the 24×24px minimum. Error toasts stay for 8 seconds, so dismissing them is a real action.

**Framework.** WCAG 2.2 SC 2.5.8. Not measured: no live render.

**Fix.** `min-width: 32px; min-height: 32px;` on `.toastClose`.

### 8. Heading inside `<summary>` — Polish, potential, unverified

**What's wrong.** The collapsible history panels put an `<h2>` inside `<summary>` (`Dashboard.tsx:494-495`). `<summary>` exposes a button role. Some screen readers flatten its children, so "Answered" and "Rejected" may drop out of heading navigation.

**Framework.** WCAG 1.3.1. Not tested with a screen reader.

**Fix.** If a screen-reader check confirms it, move the heading outside the summary, or use a plain `<button aria-expanded>` with the `<h2>` wrapping it.

## Appendix — not covered

- **No live pass.** Nothing was rendered in a browser, so actual focus order, real target sizes, layout at the 1100px breakpoint, drag-and-drop behaviour and toast timing were not observed. Findings 7 and 8 need a live check.
- **No screen-reader testing** (NVDA, VoiceOver, etc.).
- **The login flow** (`/login`) that gates this page, and the host and presentation pages, are out of scope.
- **Realtime and reconnect behaviour** (the "reconnecting" and "session expired" banners) was only read in code, not triggered.
- **Contrast of disabled controls** was not scored: WCAG exempts inactive components.
- **Things checked and found fine** (no finding): primary/lapis/stone/quiet button contrast (≥ 4.74:1); faint text on cards and panels (≥ 4.84:1); the gold note text (10.2:1); sort buttons at 28×28px; the global gold `:focus-visible` outline; the `prefers-reduced-motion` freeze, which also stops the live-dot pulse; only the acted-on card is disabled while a request runs; 409 errors are explained in plain language.
