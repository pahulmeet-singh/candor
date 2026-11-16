import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_META } from "@/lib/constants/difficulty";
import { READINESS_META } from "@/lib/scoring";
import { STATUS_LABEL } from "@/lib/status";

const STATUS_TONE = {
  SCHEDULED: "info",
  IN_PROGRESS: "primary",
  COMPLETED: "success",
  CANCELLED: "neutral",
  MISSED: "danger",
};

export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function DifficultyBadge({ difficulty }) {
  return <Badge tone="outline">{DIFFICULTY_META[difficulty].label}</Badge>;
}

const READINESS_TONE = {
  NEEDS_WORK: "danger",
  ON_TRACK: "primary",
  INTERVIEW_READY: "success",
};

export function ReadinessBadge({ readiness }) {
  return <Badge tone={READINESS_TONE[readiness]}>{READINESS_META[readiness].label}</Badge>;
}
