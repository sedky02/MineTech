"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import type { AuthUser, Role } from "@/lib/api/types";
import { HOME_BY_ROLE } from "@/lib/auth/routes";

type AuthState =
  | { status: "loading" }
  | { status: "ready"; user: AuthUser }
  | { status: "wrong-role"; user: AuthUser }
  | { status: "error"; message: string };

/**
 * Gates an internal page on the client for UX only. Every API call is
 * authorized again by the server; hiding UI is not authorization.
 */
export function useAuth(requiredRole: Role) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then(({ user }) => {
        if (!cancelled) setState({ status: user.role === requiredRole ? "ready" : "wrong-role", user });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(HOME_BY_ROLE[requiredRole])}`);
        } else {
          setState({ status: "error", message: error instanceof Error ? error.message : "Unknown error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requiredRole, router, attempt]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    router.replace("/login");
  }, [router]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, logout, retry };
}
