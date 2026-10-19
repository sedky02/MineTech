import { apiFetch } from "./client";
import type {
  AuthUser,
  EventStatus,
  ModeratorDashboard,
  ModeratorQuestion,
  PublicEventStatus,
  PublicQuestion,
} from "./types";

export interface NewQuestion {
  category: string;
  content: string;
  displayName?: string;
}

export const publicApi = {
  eventStatus: () => apiFetch<PublicEventStatus>("/event/status"),
  submitQuestion: (question: NewQuestion) =>
    apiFetch<{ received: true }>("/questions", { method: "POST", body: question }),
  presentationCurrent: () => apiFetch<{ question: PublicQuestion | null }>("/presentation/current"),
};

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<{ user: AuthUser }>("/auth/login", { method: "POST", body: { username, password } }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<{ user: AuthUser }>("/auth/me"),
};

/** Each maps to `PATCH /moderator/questions/:id/<action>`. */
export type ModeratorAction = "approve" | "reject" | "display" | "remove" | "answer" | "rollback" | "review";

export const moderatorApi = {
  dashboard: () => apiFetch<ModeratorDashboard>("/moderator/questions"),
  act: (id: string, action: ModeratorAction) =>
    apiFetch<ModeratorQuestion>(`/moderator/questions/${id}/${action}`, { method: "PATCH" }),
  reorder: (ids: string[]) =>
    apiFetch<{ ids: string[] }>("/moderator/questions/reorder", { method: "PATCH", body: { ids } }),
  eventStatus: () => apiFetch<EventStatus>("/moderator/event/status"),
  pause: () => apiFetch<EventStatus>("/moderator/event/pause", { method: "PATCH" }),
  resume: () => apiFetch<EventStatus>("/moderator/event/resume", { method: "PATCH" }),
};

export const hostApi = {
  current: () => apiFetch<{ question: PublicQuestion | null }>("/host/question"),
  approve: (id: string) => apiFetch<PublicQuestion>(`/host/questions/${id}/approve`, { method: "PATCH" }),
  reject: (id: string) => apiFetch<PublicQuestion>(`/host/questions/${id}/reject`, { method: "PATCH" }),
};
