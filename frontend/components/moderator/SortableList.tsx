"use client";

import { useState } from "react";
import styles from "./moderator.module.css";

interface SortableListProps<T extends { id: string }> {
  items: T[];
  disabled?: boolean;
  /** Called with the ids of `items` in their new order. */
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T, controls: React.ReactNode) => React.ReactNode;
}

/**
 * Drag-and-drop reordering within one list (native HTML5 drag events), plus
 * up/down buttons for keyboard and touch users.
 */
export function SortableList<T extends { id: string }>({ items, disabled, onReorder, renderItem }: SortableListProps<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const ids = items.map((item) => item.id);
  const draggingHere = dragId !== null && ids.includes(dragId);

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  }

  function reset() {
    setDragId(null);
    setDropIndex(null);
  }

  function onDragOver(event: React.DragEvent<HTMLDivElement>, index: number) {
    // Only accept drops from this list: moving between lists is done with the action buttons.
    if (!draggingHere) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const rect = event.currentTarget.getBoundingClientRect();
    setDropIndex(event.clientY < rect.top + rect.height / 2 ? index : index + 1);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    if (dragId !== null && dropIndex !== null) {
      const from = ids.indexOf(dragId);
      move(from, dropIndex > from ? dropIndex - 1 : dropIndex);
    }
    reset();
  }

  return (
    <>
      {items.map((item, index) => {
        const controls = (
          <div className={styles.sortControls}>
            <span className={styles.dragHandle} aria-hidden title="Drag to change priority">
              ⠿
            </span>
            <button
              type="button"
              className={styles.sortButton}
              onClick={() => move(index, index - 1)}
              disabled={disabled || index === 0}
              aria-label="Move up"
              title="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              className={styles.sortButton}
              onClick={() => move(index, index + 1)}
              disabled={disabled || index === items.length - 1}
              aria-label="Move down"
              title="Move down"
            >
              ▼
            </button>
          </div>
        );
        const drop =
          draggingHere && dropIndex === index ? "before" : draggingHere && dropIndex === index + 1 ? "after" : undefined;

        return (
          <div
            key={item.id}
            className={styles.sortItem}
            draggable={!disabled && items.length > 1}
            data-dragging={dragId === item.id}
            data-drag-active={dragId !== null || undefined}
            data-drop={drop}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id); // required by Firefox
              setDragId(item.id);
            }}
            onDragOver={(event) => onDragOver(event, index)}
            onDrop={onDrop}
            onDragEnd={reset}
          >
            {renderItem(item, controls)}
          </div>
        );
      })}
    </>
  );
}
