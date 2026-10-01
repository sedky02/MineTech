import { API_URL } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
}

/**
 * Fetch wrapper for the NestJS API. Sends cookies (auth + participant
 * session) and throws ApiError for anything that isn't a 2xx response.
 */
export async function apiFetch<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { message, retryAfterSeconds } = (data ?? {}) as {
      message?: string | string[];
      retryAfterSeconds?: number;
    };
    throw new ApiError(
      response.status,
      Array.isArray(message) ? message.join(". ") : (message ?? "Something went wrong. Please try again."),
      retryAfterSeconds,
    );
  }
  return data as T;
}
