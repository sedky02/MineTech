/** Mirrors the server rules (SPEC §8). The server remains the authority. */
export const QUESTION_MIN = 10;
export const QUESTION_MAX = 500;
export const DISPLAY_NAME_MAX = 50;

export function validateQuestion(input: { category: string; content: string; displayName: string }): string | null {
  if (!input.category) return "Pick a category first.";
  const length = input.content.trim().length;
  if (length < QUESTION_MIN) return `Your question needs at least ${QUESTION_MIN} characters.`;
  if (length > QUESTION_MAX) return `Your question can be at most ${QUESTION_MAX} characters.`;
  if (input.displayName.trim().length > DISPLAY_NAME_MAX) {
    return `Your name can be at most ${DISPLAY_NAME_MAX} characters.`;
  }
  return null;
}
