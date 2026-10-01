import Link from "next/link";
import { QuestionForm } from "@/components/participant/QuestionForm";
import styles from "@/components/participant/participant.module.css";
import { Wordmark } from "@/components/ui/Logo";
import { CLUB_NAME } from "@/lib/config";

export default function ParticipantPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Wordmark size={48} subtitle={CLUB_NAME || "Tech event Q&A"} />
        <p className={styles.intro}>
          Ask the speakers anything about tech, studies or careers. Your question is anonymous unless you add your
          name.
        </p>
      </header>
      <QuestionForm />
      <footer className={styles.footer}>
        <Link href="/presentation" target="_blank" rel="noopener" className={`btn btn-quiet ${styles.screenLink}`}>
          See what&apos;s on screen ↗
        </Link>
        <p>Questions are reviewed before they appear on screen.</p>
      </footer>
    </main>
  );
}
