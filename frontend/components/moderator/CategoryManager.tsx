"use client";

import { useState } from "react";
import { BlockSwatch } from "@/components/ui/CategoryTag";
import type { ModeratorCategory } from "@/lib/api/types";
import styles from "./moderator.module.css";

const NAME_MAX = 40;

interface Props {
  categories: ModeratorCategory[];
  busy: (id: string) => boolean;
  /** Each resolves to whether the server accepted the change. */
  onCreate: (name: string) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onToggleVisible: (category: ModeratorCategory) => Promise<boolean>;
  onDelete: (category: ModeratorCategory) => Promise<boolean>;
}

/**
 * Add, rename, hide and delete the topics students pick from. Collapsed by
 * default: it's set-up work, not part of running the live queue.
 */
export function CategoryManager({ categories, busy, onCreate, onRename, onToggleVisible, onDelete }: Props) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const visibleCount = categories.filter((c) => c.isActive).length;
  const hiddenCount = categories.length - visibleCount;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (await onCreate(name)) setNewName("");
  }

  async function saveRename() {
    if (!editing) return;
    const name = editing.name.trim();
    const original = categories.find((c) => c.id === editing.id)?.name;
    if (!name || name === original) {
      setEditing(null);
      return;
    }
    if (await onRename(editing.id, name)) setEditing(null);
  }

  return (
    <details className={`panel ${styles.manager}`}>
      <summary className={styles.managerSummary}>
        <span className="panel-title">Topics</span>
        <span className={styles.managerMeta}>
          {visibleCount} visible{hiddenCount > 0 && ` · ${hiddenCount} hidden`}
        </span>
        <span className={styles.managerHint}>Add, rename, hide or delete the topics students pick from</span>
      </summary>

      <form className={styles.managerAdd} onSubmit={create}>
        <label htmlFor="new-topic" className="sr-only">
          New topic name
        </label>
        <input
          id="new-topic"
          className="input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={NAME_MAX}
          placeholder="New topic, e.g. Game Development"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary" disabled={!newName.trim() || busy("new")}>
          Add topic
        </button>
      </form>

      <p id="topic-delete-rule" className={styles.managerRule}>
        Topics with questions can be hidden but not deleted, so their questions keep their topic.
      </p>

      <ul className={styles.topicList}>
        {categories.map((category) => {
          const isEditing = editing?.id === category.id;
          const isBusy = busy(category.id);
          const lastVisible = category.isActive && visibleCount === 1;
          return (
            <li key={category.id} className={styles.topicRow} data-hidden={!category.isActive || undefined}>
              <BlockSwatch slug={category.slug} size={16} />

              {isEditing ? (
                <input
                  className={`input ${styles.topicInput}`}
                  value={editing.name}
                  onChange={(e) => setEditing({ id: category.id, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveRename();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  maxLength={NAME_MAX}
                  aria-label={`New name for ${category.name}`}
                  autoFocus
                />
              ) : (
                <span className={styles.topicName}>{category.name}</span>
              )}

              <span className={styles.topicMeta}>
                {category.questionCount} question{category.questionCount === 1 ? "" : "s"}
                {!category.isActive && <span className={styles.hiddenBadge}>Hidden</span>}
              </span>

              <div className={styles.topicActions}>
                {isEditing ? (
                  <>
                    <button type="button" className="btn btn-sm btn-primary" onClick={saveRename} disabled={isBusy}>
                      Save
                    </button>
                    <button type="button" className="btn btn-sm btn-quiet" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet"
                      onClick={() => setEditing({ id: category.id, name: category.name })}
                      disabled={isBusy}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet"
                      onClick={() => onToggleVisible(category)}
                      disabled={isBusy || lastVisible}
                      title={lastVisible ? "Students need at least one visible topic" : undefined}
                    >
                      {category.isActive ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet-danger"
                      onClick={() => onDelete(category)}
                      disabled={isBusy || category.questionCount > 0 || lastVisible}
                      aria-describedby={category.questionCount > 0 ? "topic-delete-rule" : undefined}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
