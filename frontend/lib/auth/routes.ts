import type { Role } from "@/lib/api/types";

export const HOME_BY_ROLE: Record<Role, string> = {
  MODERATOR: "/moderator",
  HOST: "/host",
};

/** Only follow ?next= to the page that matches the user's role. */
export function landingPageFor(role: Role, next: string | null): string {
  return next === HOME_BY_ROLE[role] ? next : HOME_BY_ROLE[role];
}
