/**
 * Types shared between the server and the browser.
 *
 * Everything here is plain, serialisable data. Dates are ISO-8601 strings, not
 * `Date` objects: Server Components pass props to Client Components as JSON, and
 * Route Handlers send JSON, so a `Date` would silently become a string anyway.
 * The data layer (`lib/data/*`) is the only place that converts Prisma rows to
 * these shapes, which also means `passwordHash` can never leak into a response.
 */

import type { CategoryKey } from "@/lib/constants/categories";
import type { Difficulty } from "@/lib/constants/difficulty";
import type { ErrorCode, FieldErrors } from "@/lib/errors";
import type { Readiness } from "@/lib/scoring";
import type { SlotState } from "@/lib/slots";
import type { Evaluation } from "@/lib/validations/feedback";
import type { Transcript } from "@/lib/validations/session";

export type Role = "USER" | "ADMIN";
export type InterviewStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
/** Stored status plus the derived "MISSED" (see lib/status.ts). */
export type DisplayStatus = InterviewStatus | "MISSED";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
}

export interface ResumeDTO {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface InterviewDTO {
  id: string;
  category: CategoryKey;
  difficulty: Difficulty;
  scheduledAt: string;
  durationMin: number;
  status: InterviewStatus;
  displayStatus: DisplayStatus;
  startedAt: string | null;
  completedAt: string | null;
  usesResume: boolean;
  feedbackId: string | null;
  overallScore: number | null;
  createdAt: string;
}

export interface InterviewDetailDTO extends InterviewDTO {
  transcript: Transcript | null;
}

export interface FeedbackListItemDTO {
  id: string;
  interviewId: string;
  category: CategoryKey;
  difficulty: Difficulty;
  overallScore: number;
  readiness: Readiness;
  summary: string;
  completedAt: string;
  createdAt: string;
}

export interface FeedbackDetailDTO {
  id: string;
  interviewId: string;
  overallScore: number;
  readiness: Readiness;
  model: string;
  createdAt: string;
  evaluation: Evaluation;
  transcript: Transcript;
  interview: {
    id: string;
    category: CategoryKey;
    difficulty: Difficulty;
    scheduledAt: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMin: number;
  };
}

export interface SlotDTO {
  start: string;
  end: string;
  booked: number;
  capacity: number;
  state: SlotState;
}

export interface SlotsResponse {
  date: string;
  slots: SlotDTO[];
  activeBookings: number;
  maxActiveBookings: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UserStatsDTO {
  completed: number;
  upcoming: number;
  average: number | null;
  best: number | null;
  latest: number | null;
  /** Latest score minus the previous one; null until there are two reports. */
  delta: number | null;
  readiness: Readiness | null;
}

export interface TrendPointDTO {
  id: string;
  date: string;
  score: number;
  category: CategoryKey;
}

export interface PublicStatsDTO {
  interviews: number;
  reports: number;
  learners: number;
}

export interface AdminUserRowDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  interviews: number;
  reports: number;
}

export interface AdminOverviewDTO {
  users: number;
  admins: number;
  interviews: number;
  reports: number;
  resumes: number;
  averageScore: number | null;
  byCategory: Array<{ category: CategoryKey; interviews: number }>;
}

/** What every Server Action returns, so forms can render errors without try/catch. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: ErrorCode; fieldErrors?: FieldErrors };
