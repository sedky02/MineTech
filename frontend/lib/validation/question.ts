/** Mirrors the server rules (SPEC §8). The server remains the authority. */
export const QUESTION_MIN = 1;
export const QUESTION_MAX = 500;
export const DISPLAY_NAME_MAX = 50;

export type QuestionField = "category" | "content" | "displayName";

export interface FieldError {
  field: QuestionField;
  message: string;
}

/** Returns the first problem, tagged with the field it belongs to, so the form can show it there. */
export function validateQuestion(input: { category: string; content: string; displayName: string }): FieldError | null {
  if (!input.category) return { field: "category", message: "Pick a topic first." };
  const length = input.content.trim().length;
  if (length < QUESTION_MIN) return { field: "content", message: "Write your question first." };
  if (length > QUESTION_MAX) {
    return { field: "content", message: `Your question can be at most ${QUESTION_MAX} characters.` };
  }
  if (input.displayName.trim().length > DISPLAY_NAME_MAX) {
    return { field: "displayName", message: `Your name can be at most ${DISPLAY_NAME_MAX} characters.` };
  }
  return null;
}
