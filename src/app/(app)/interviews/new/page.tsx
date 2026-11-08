import type { Metadata } from "next";
import { BookingForm, type TailoringMode } from "@/components/booking/booking-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/session";
import { CATEGORY_KEYS, isCategoryKey } from "@/lib/constants/categories";
import { getResume } from "@/lib/data/resume";
import { env } from "@/lib/env";
import { bookableDateKeys } from "@/lib/slots";

export const metadata: Metadata = { title: "Book an interview" };

/**
 * A server-rendered shell around a client-side form. The server decides what the
 * user may do (which days are open, whether a résumé exists, whether an AI key is
 * configured) and the form handles the interaction.
 */
export default async function NewInterviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const requested = typeof params.category === "string" ? params.category : undefined;
  const initialCategory = isCategoryKey(requested) ? requested : CATEGORY_KEYS[0];
  const resume = await getResume(user.id);

  const tailoring: TailoringMode = !resume ? "no-resume" : env.aiMode === "mock" ? "offline" : "available";

  return (
    <>
      <PageHeader
        title="Book an interview"
        description="Choose a topic and a level, then take one of the open half-hour slots."
      />
      <BookingForm
        dates={bookableDateKeys(new Date())}
        resume={resume}
        initialCategory={initialCategory}
        tailoring={tailoring}
      />
    </>
  );
}
