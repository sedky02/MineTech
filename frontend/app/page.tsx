import Link from "next/link";
import { ParticipantShell } from "@/components/participant/ParticipantShell";
import { QuestionForm } from "@/components/participant/QuestionForm";
import styles from "@/components/participant/participant.module.css";
import { ClubCredit, Wordmark } from "@/components/ui/Logo";

export default function ParticipantPage() {
  return (
    <ParticipantShell
      brand={<Wordmark size={64} titleAs="h1" />}
      footer={
        <footer className={styles.footer}>
          <Link href="/presentation" target="_blank" rel="noopener" className={`btn btn-quiet ${styles.screenLink}`}>
            See what&apos;s on screen <span aria-hidden>↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
          <p>Questions are reviewed before they appear on screen.</p>
          <ClubCredit height={40} className={styles.credit} />
        </footer>
      }
    >
      <QuestionForm />
    </ParticipantShell>
  );
}
