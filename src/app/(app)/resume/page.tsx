import type { Metadata } from "next";
import { ResumeManager } from "@/components/resume/resume-manager";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getResume } from "@/lib/data/resume";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Résumé" };

/**
 * Server-rendered: the page reads the user's résumé row through Prisma, then hands
 * it to a Client Component that owns the upload form (a Server Action under the hood).
 */
export default async function ResumePage() {
  const user = await requireUser();
  const resume = await getResume(user.id);

  return (
    <>
      <PageHeader
        title="Résumé"
        description="Keep one PDF on file and a session can ask about your own projects."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="grid gap-5">
          {env.storageConfigured ? null : (
            <Alert tone="warning" title="File storage is not configured">
              Set <code className="font-mono text-[0.85em]">SUPABASE_URL</code> and{" "}
              <code className="font-mono text-[0.85em]">SUPABASE_SERVICE_ROLE_KEY</code> to enable uploads. The
              steps are in docs/DEPLOYMENT.md.
            </Alert>
          )}
          <ResumeManager resume={resume} />
        </div>

        <aside className="grid gap-4" aria-label="About your résumé">
          <Card className="p-5">
            <h2 className="font-serif text-lg font-semibold">Where it is kept</h2>
            <p className="mt-2 text-sm text-muted">
              In a private storage bucket. Nobody gets a permanent link: when you press Download the server checks the
              file is yours and hands out a link that stops working after a minute.
            </p>
          </Card>
          <Card className="p-5">
            <h2 className="font-serif text-lg font-semibold">When it is used</h2>
            <p className="mt-2 text-sm text-muted">
              Only when you switch on &ldquo;Ask questions about my résumé&rdquo; while booking. The PDF is then sent to
              Google&rsquo;s Gemini API to write the questions. Free-tier API data may be used by Google to improve its
              products, so leave the switch off if that matters to you.
            </p>
            {env.aiMode === "mock" ? (
              <p className="mt-3 text-sm text-muted">
                This deployment runs without an AI key, so the file is stored but not read.
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </>
  );
}
