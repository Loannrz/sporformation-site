import { SESSION_COOKIE_NAME } from "@/lib/constants";
import { cookies } from "next/headers";
import type { SessionUser } from "@/types";

export { SESSION_COOKIE_NAME };

export async function readSessionCookie(): Promise<SessionUser | null> {
  const jar = cookies();
  const raw = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    return JSON.parse(json) as SessionUser;
  } catch {
    return null;
  }
}

export function encodeSessionUser(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}
