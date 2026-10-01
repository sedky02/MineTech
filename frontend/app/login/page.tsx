import type { Metadata } from "next";
import { Suspense } from "react";
import { Wordmark } from "@/components/ui/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Team login",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <main className="center-screen">
      <div className="login-shell">
        <Wordmark size={44} subtitle="Moderator & host login" />
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
