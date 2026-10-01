import type { Prisma } from '../generated/prisma/client.js';

export const withCategory = {
  category: { select: { name: true, slug: true } },
} as const satisfies Prisma.QuestionInclude;

export type QuestionWithCategory = Prisma.QuestionGetPayload<{
  include: typeof withCategory;
}>;

/** Everything except the participant session ID, which never leaves the server. */
export function toModeratorView(q: QuestionWithCategory) {
  return {
    id: q.id,
    content: q.content,
    displayName: q.displayName,
    category: q.category,
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
export function toPublicView(q: QuestionWithCategory) {
  return {
    id: q.id,
    content: q.content,
    displayName: q.displayName,
    category: q.category,
  };
}

export type ModeratorQuestionView = ReturnType<typeof toModeratorView>;
export type PublicQuestionView = ReturnType<typeof toPublicView>;
