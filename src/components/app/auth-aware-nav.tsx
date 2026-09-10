import { getCurrentSession } from "@/server/dal/session";

import { MobileNav } from "./mobile-nav";

/** Reads the session on the server and passes only a safe DTO into the interactive nav. */
export async function AuthAwareNav() {
  const session = await getCurrentSession();

  return <MobileNav user={session?.user ?? null} />;
}
