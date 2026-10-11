/**
 * The fixed list of question topics, in the order students see them.
 * Kept identical to frontend/lib/categories.ts. The questions.category column
 * has a CHECK constraint with these slugs: changing the list needs a migration.
 */
export const CATEGORIES = [
  { slug: 'general', name: 'General' },
  { slug: 'career-studies', name: 'Career & Studies' },
  { slug: 'ai-data', name: 'AI & Data' },
  { slug: 'web-development', name: 'Web Development' },
  { slug: 'cybersecurity', name: 'Cybersecurity' },
  { slug: 'mobile-development', name: 'Mobile Development' },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_SLUGS: readonly CategorySlug[] = CATEGORIES.map(
  (c) => c.slug,
);

const BY_SLUG = new Map<string, Category>(CATEGORIES.map((c) => [c.slug, c]));

/** The `{ slug, name }` shape the API returns for a stored slug. */
export function categoryView(slug: string): { slug: string; name: string } {
  const category = BY_SLUG.get(slug);
  return { slug, name: category?.name ?? slug };
}
