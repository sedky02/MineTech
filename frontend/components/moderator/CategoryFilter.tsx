import { BlockSwatch } from "@/components/ui/CategoryTag";
import type { Category } from "@/lib/api/types";
import styles from "./moderator.module.css";

export const ALL_CATEGORIES = "all";

interface Props {
  categories: Category[];
  counts: Record<string, number>;
  total: number;
  selected: string;
  onSelect: (slug: string) => void;
}

/** Filters every list by category. Counts cover the working lists (To review, With host, Ready). */
export function CategoryFilter({ categories, counts, total, selected, onSelect }: Props) {
  return (
    <div className={styles.filter} role="group" aria-label="Filter questions by category">
      <button
        type="button"
        className={styles.filterChip}
        aria-pressed={selected === ALL_CATEGORIES}
        onClick={() => onSelect(ALL_CATEGORIES)}
      >
        All <span className={styles.filterCount}>{total}</span>
      </button>
      {categories.map((category) => (
        <button
          key={category.slug}
          type="button"
          className={styles.filterChip}
          aria-pressed={selected === category.slug}
          onClick={() => onSelect(category.slug)}
        >
          <BlockSwatch slug={category.slug} size={12} />
          {category.name} <span className={styles.filterCount}>{counts[category.slug] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
