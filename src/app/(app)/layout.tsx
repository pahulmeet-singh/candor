import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";

/**
 * Layout for every signed-in page. `requireUser()` redirects to /login when
 * there is no valid session, and gives the shell the name for the user menu.
 *
 * It is not the only gate. Layouts do not re-render when you move between
 * pages that share them, so a check that lives only here can be skipped on a
 * client-side navigation. Every page that reads user data asks again (cheap:
 * `getCurrentUser` is wrapped in `React.cache`), and so does every Server
 * Action and Route Handler, because those can be called without a layout.
 *
 * `modal` is a parallel-route slot (`@modal`): it renders the report as a
 * dialog on top of the current page when a /feedback/[id] link is followed
 * from inside the app, and renders nothing otherwise.
 */
export default async function AppLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell user={user}>
      {children}
      {modal}
    </AppShell>
  );
}
