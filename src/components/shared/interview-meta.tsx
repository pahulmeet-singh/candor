import { Badge, type BadgeTone } from "@/components/ui/badge";
import { DIFFICULTY_META, type Difficulty } from "@/lib/constants/difficulty";
import { READINESS_META, type Readiness } from "@/lib/scoring";
import { STATUS_LABEL } from "@/lib/status";
import type { DisplayStatus } from "@/lib/types";

const STATUS_TONE: Record<DisplayStatus, BadgeTone> = {
  SCHEDULED: "info",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  CANCELLED: "neutral",
  MISSED: "danger",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <Badge tone="outline">{DIFFICULTY_META[difficulty].label}</Badge>;
}

const READINESS_TONE: Record<Readiness, BadgeTone> = {
  NEEDS_WORK: "danger",
  ON_TRACK: "primary",
  INTERVIEW_READY: "success",
};

export function ReadinessBadge({ readiness }: { readiness: Readiness }) {
  return <Badge tone={READINESS_TONE[readiness]}>{READINESS_META[readiness].label}</Badge>;
}
