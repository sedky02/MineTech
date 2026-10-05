export type Role = "MODERATOR" | "HOST";

export type QuestionStatus =
  | "PENDING"
  | "MODERATOR_APPROVED"
  | "REJECTED"
  | "HOST_APPROVED"
  | "DISPLAYED"
  | "ANSWERED";

export interface Category {
  name: string;
  slug: string;
}

/** What the host and the presentation screen receive. */
export interface PublicQuestion {
  id: string;
  content: string;
  displayName: string | null;
  category: Category;
}

export interface ModeratorQuestion extends PublicQuestion {
  status: QuestionStatus;
  source: "PRE_EVENT" | "LIVE";
  createdAt: string;
  moderatorApprovedAt: string | null;
  moderatorRejectedAt: string | null;
  hostApprovedAt: string | null;
  hostRejectedAt: string | null;
  displayedAt: string | null;
  answeredAt: string | null;
}

export interface ModeratorDashboard {
  pending: ModeratorQuestion[];
  awaitingHost: ModeratorQuestion[];
  ready: ModeratorQuestion[];
  displayed: ModeratorQuestion | null;
  previous: ModeratorQuestion | null;
  stats: { answered: number; rejected: number };
}

export interface PublicEventStatus {
  submissionsOpen: boolean;
}

export interface EventStatus extends PublicEventStatus {
  paused: boolean;
  eventStartsAt: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
}
