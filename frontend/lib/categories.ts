import type { Category } from "@/lib/api/types";

/**
 * The fixed list of question topics, in the order students see them.
 * Kept identical to backend/src/common/categories.ts, which validates them.
 */
export const CATEGORIES: Category[] = [
  { slug: "general", name: "General" },
  { slug: "career-studies", name: "Career & Studies" },
  { slug: "ai-data", name: "AI & Data" },
  { slug: "web-development", name: "Web Development" },
  { slug: "cybersecurity", name: "Cybersecurity" },
  { slug: "mobile-development", name: "Mobile Development" },
];
