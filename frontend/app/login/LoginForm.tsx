"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authApi } from "@/lib/api/endpoints";
import { landingPageFor } from "@/lib/auth/routes";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await authApi.login(username.trim(), password);
      router.replace(landingPageFor(user.role, next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      setSubmitting(false);
    }
  }

  return (
    <form className="panel login-form" onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="username" className="field-label">
          Username
        </label>
        <input
          id="username"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={submitting || !username || !password}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
