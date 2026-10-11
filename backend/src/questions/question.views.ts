import type { Question } from '../generated/prisma/client.js';
import { categoryView } from '../common/categories.js';

/** Everything except the participant session ID, which never leaves the server. */
export function toModeratorView(q: Question) {
  return {
    id: q.id,
    content: q.content,
    displayName: q.displayName,
    category: categoryView(q.category),
    source: q.source,
    status: q.status,
    createdAt: q.createdAt,
    moderatorApprovedAt: q.moderatorApprovedAt,
    moderatorRejectedAt: q.moderatorRejectedAt,
    hostApprovedAt: q.hostApprovedAt,
    hostRejectedAt: q.hostRejectedAt,
    displayedAt: q.displayedAt,
    answeredAt: q.answeredAt,
  };
}

/** What the host and the presentation screen are allowed to see. */
export function toPublicView(q: Question) {
  return {
    id: q.id,
    content: q.content,
    displayName: q.displayName,
    category: categoryView(q.category),
  };
}

export type ModeratorQuestionView = ReturnType<typeof toModeratorView>;
export type PublicQuestionView = ReturnType<typeof toPublicView>;
