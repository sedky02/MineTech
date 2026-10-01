import type { Category } from "@/lib/api/types";
import styles from "./ui.module.css";

/** Each category gets a block colour (grass, diamond, redstone, ...). */
export const CATEGORY_COLORS: Record<string, string> = {
  "web-development": "var(--grass)",
  "ai-data": "var(--diamond)",
  cybersecurity: "var(--redstone)",
  "devops-cloud": "var(--lapis)",
  "mobile-development": "var(--emerald)",
  "software-engineering": "var(--iron)",
  "career-studies": "var(--gold)",
  general: "var(--stone)",
};

export function categoryColor(slug: string) {
  return CATEGORY_COLORS[slug] ?? "var(--amethyst)";
}

export function BlockSwatch({ slug, size = 14 }: { slug: string; size?: number }) {
  return (
    <span
      aria-hidden
      className={styles.swatch}
      style={{ background: categoryColor(slug), width: size, height: size }}
    />
  );
}

export function CategoryTag({ category, large = false }: { category: Category; large?: boolean }) {
  return (
    <span className={`${styles.tag} ${large ? styles.tagLarge : ""}`}>
      <BlockSwatch slug={category.slug} size={large ? 22 : 12} />
      {category.name}
    </span>
  );
}
