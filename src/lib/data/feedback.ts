import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, TREND_POINTS } from "@/lib/constants/limits";
import { countActiveBookings } from "@/lib/data/interviews";
import { toFeedbackDetail, toFeedbackListItem } from "@/lib/data/mappers";
import { prisma } from "@/lib/db";
import { average, readinessOf } from "@/lib/scoring";
import type {
  FeedbackDetailDTO,
  FeedbackListItemDTO,
  Paginated,
  TrendPointDTO,
  UserStatsDTO,
} from "@/lib/types";
import type { CategoryKey } from "@/lib/constants/categories";
import type { FeedbackFilters } from "@/lib/validations/feedback";

/**
 * Read-side queries for reports. Ownership is enforced through the interview:
 * a report belongs to whoever owns the interview it was written for.
 */

const MS_PER_DAY = 86_400_000;

const LIST_SELECT = {
  id: true,
  interviewId: true,
  overallScore: true,
  createdAt: true,
  evaluation: true,
  interview: { select: { category: true, difficulty: true, completedAt: true } },
} as const;

function orderFor(sort: FeedbackFilters["sort"]): Prisma.FeedbackOrderByWithRelationInput[] {
  switch (sort) {
    case "score_desc":
      return [{ overallScore: "desc" }, { createdAt: "desc" }];
    case "score_asc":
      return [{ overallScore: "asc" }, { createdAt: "desc" }];
    default:
      return [{ createdAt: "desc" }];
  }
}

export async function listFeedback(
  userId: string,
  filters: FeedbackFilters,
  now: Date = new Date(),
): Promise<Paginated<FeedbackListItemDTO>> {
  const days = filters.range === "30d" ? 30 : filters.range === "90d" ? 90 : null;
  const where: Prisma.FeedbackWhereInput = {
    interview: filters.category ? { userId, category: filters.category } : { userId },
    ...(days ? { createdAt: { gte: new Date(now.getTime() - days * MS_PER_DAY) } } : {}),
  };

  const total = await prisma.feedback.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);

  const rows = await prisma.feedback.findMany({
    where,
    orderBy: orderFor(filters.sort),
    select: LIST_SELECT,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return { items: rows.map(toFeedbackListItem), page, pageSize: PAGE_SIZE, total, totalPages };
}

/** The newest reports, for the dashboard. */
export async function getRecentFeedback(userId: string, limit = 3): Promise<FeedbackListItemDTO[]> {
  const rows = await prisma.feedback.findMany({
    where: { interview: { userId } },
    orderBy: { createdAt: "desc" },
    select: LIST_SELECT,
    take: limit,
  });
  return rows.map(toFeedbackListItem);
}

export async function getFeedback(userId: string, id: string): Promise<FeedbackDetailDTO | null> {
  const row = await prisma.feedback.findFirst({
    where: { id, interview: { userId } },
    select: {
      id: true,
      interviewId: true,
      overallScore: true,
      model: true,
      createdAt: true,
      evaluation: true,
      interview: {
        select: {
          id: true,
          category: true,
          difficulty: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
          durationMin: true,
          transcript: true,
        },
      },
    },
  });
  return row ? toFeedbackDetail(row) : null;
}

/** Oldest first, so the chart reads left to right. */
export async function getTrend(userId: string): Promise<TrendPointDTO[]> {
  const rows = await prisma.feedback.findMany({
    where: { interview: { userId } },
    orderBy: { createdAt: "desc" },
    take: TREND_POINTS,
    select: {
      id: true,
      overallScore: true,
      createdAt: true,
      interview: { select: { category: true, completedAt: true } },
    },
  });
  return rows.reverse().map((row) => ({
    id: row.id,
    date: (row.interview.completedAt ?? row.createdAt).toISOString(),
    score: row.overallScore,
    category: row.interview.category as CategoryKey,
  }));
}

/**
 * Headline numbers for the dashboard. "Readiness" is the band of the mean of
 * the three newest scores, so one unusually good or bad session does not swing it.
 */
export async function getUserStats(userId: string, now: Date = new Date()): Promise<UserStatsDTO> {
  const [aggregate, recent, upcoming] = await Promise.all([
    prisma.feedback.aggregate({
      where: { interview: { userId } },
      _count: { _all: true },
      _avg: { overallScore: true },
      _max: { overallScore: true },
    }),
    prisma.feedback.findMany({
      where: { interview: { userId } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { overallScore: true },
    }),
    countActiveBookings(userId, now),
  ]);

  const scores = recent.map((row) => row.overallScore);
  const avg = aggregate._avg.overallScore;

  return {
    completed: aggregate._count._all,
    upcoming,
    average: avg === null ? null : Math.round(avg),
    best: aggregate._max.overallScore,
    latest: scores[0] ?? null,
    delta: scores.length >= 2 ? scores[0] - scores[1] : null,
    readiness: scores.length > 0 ? readinessOf(Math.round(average(scores))) : null,
  };
}
