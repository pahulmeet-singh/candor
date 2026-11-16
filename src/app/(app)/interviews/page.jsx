import { Plus } from "lucide-react";
import Link from "next/link";
import { InterviewList } from "@/components/interview/interview-list";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { buttonVariants } from "@/components/ui/button";
import { TabLinks } from "@/components/ui/tab-links";
import { requireUser } from "@/lib/auth/session";
import { listInterviews } from "@/lib/data/interviews";
import { interviewListSchema } from "@/lib/validations/booking";

export const metadata = { title: "Interviews" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

/**
 * Server-side rendering driven by the URL: `?tab=past&page=2` is parsed with Zod
 * (bad values fall back to defaults), queried through Prisma and rendered on the
 * server. Because the state lives in the URL, every view can be bookmarked and the
 * back button works without any client state.
 */
export default async function InterviewsPage({ searchParams }) {
  const user = await requireUser();
  const query = interviewListSchema.parse(await searchParams);
  const list = await listInterviews(user.id, query);

  const hrefFor = (page, tab = list.tab) => `/interviews?tab=${tab}${page > 1 ? `&page=${page}` : ""}`;

  return (
    <>
      <PageHeader
        title="Interviews"
        description="Your booked, finished and cancelled sessions."
        actions={
          <Link href="/interviews/new" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            Book an interview
          </Link>
        }
      />

      <div className="grid gap-5">
        <TabLinks
          label="Interview status"
          tabs={TABS.map((tab) => ({
            href: hrefFor(1, tab.key),
            label: tab.label,
            count: list.counts[tab.key],
            active: tab.key === list.tab,
          }))}
        />
        {/* Remounted per tab and page so the optimistic state never carries over between views. */}
        <InterviewList key={`${list.tab}:${list.page}`} interviews={list.items} tab={list.tab} />
        <Pagination page={list.page} totalPages={list.totalPages} hrefFor={(page) => hrefFor(page)} />
      </div>
    </>
  );
}
