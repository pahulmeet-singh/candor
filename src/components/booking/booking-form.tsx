"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { bookInterviewAction } from "@/actions/interviews";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES, categoryLabel, type CategoryKey } from "@/lib/constants/categories";
import { DIFFICULTIES, DIFFICULTY_META, type Difficulty } from "@/lib/constants/difficulty";
import { QUESTIONS_PER_SESSION } from "@/lib/constants/limits";
import { formatDay, formatTimeRange } from "@/lib/format";
import { SLOT_RULES } from "@/lib/slots";
import type { ResumeDTO } from "@/lib/types";
import { SlotPicker } from "./slot-picker";
import { useSlots } from "./use-slots";

/** Why the "tailor to my résumé" switch is, or is not, available. */
export type TailoringMode = "available" | "no-resume" | "offline";

interface BookingFormProps {
  dates: string[];
  resume: ResumeDTO | null;
  initialCategory: CategoryKey;
  tailoring: TailoringMode;
}

const CHOICE_CARD =
  "flex h-full cursor-pointer gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:bg-raised peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary";

/**
 * The booking screen. It is a Client Component because it is interactive (choices,
 * a day strip, a slot grid fetched on demand); the page around it is rendered on
 * the server. The booking itself goes through a Server Action, which validates
 * the input again with Zod and re-checks capacity inside a serializable transaction.
 */
export function BookingForm({ dates, resume, initialCategory, tailoring }: BookingFormProps) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryKey>(initialCategory);
  const [difficulty, setDifficulty] = useState<Difficulty>("INTERMEDIATE");
  const [date, setDate] = useState(dates[0]);
  const [slot, setSlot] = useState<string | null>(null);
  const [tailor, setTailor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const slots = useSlots(date);

  function changeDate(next: string) {
    setDate(next);
    setSlot(null);
  }

  function confirm() {
    if (!slot) return;
    setError(null);
    startTransition(async () => {
      const result = await bookInterviewAction({
        category,
        difficulty,
        scheduledAt: slot,
        useResume: tailor && tailoring === "available",
      });
      if (result.ok) {
        toast.success("Your interview is booked.");
        router.push(`/interviews/${result.data.id}`);
        return;
      }
      setError(result.error);
      // Someone else may have taken the seat, or the slot closed while the page was open.
      if (result.code === "SLOT_FULL" || result.code === "SLOT_INVALID" || result.code === "CONFLICT") {
        setSlot(null);
        slots.refresh();
      }
    });
  }

  const slotEnd = slot ? new Date(Date.parse(slot) + SLOT_RULES.lengthMinutes * 60_000).toISOString() : null;

  return (
    // `grid-cols-1` and `min-w-0` let this column shrink to the screen. Without them the scrolling
    // day strip inside the slot picker stretches the whole form to the width of all 14 days.
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div className="grid min-w-0 gap-8">
        <fieldset className="grid gap-3">
          <legend className="mb-1 font-serif text-xl font-semibold tracking-tight">What do you want to practise?</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {CATEGORIES.map((item) => (
              <label key={item.key}>
                <input
                  type="radio"
                  name="category"
                  value={item.key}
                  checked={category === item.key}
                  onChange={() => setCategory(item.key)}
                  className="peer sr-only"
                />
                <span className={CHOICE_CARD}>
                  <CategoryIcon category={item.key} className="mt-0.5 size-5 shrink-0 text-primary" />
                  <span className="grid gap-0.5">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-sm text-muted">{item.short}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="mb-1 font-serif text-xl font-semibold tracking-tight">How hard should it be?</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {DIFFICULTIES.map((level) => (
              <label key={level}>
                <input
                  type="radio"
                  name="difficulty"
                  value={level}
                  checked={difficulty === level}
                  onChange={() => setDifficulty(level)}
                  className="peer sr-only"
                />
                <span className={CHOICE_CARD}>
                  <span className="grid gap-0.5">
                    <span className="font-medium">{DIFFICULTY_META[level].label}</span>
                    <span className="text-sm text-muted">{DIFFICULTY_META[level].blurb}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <section className="grid gap-3" aria-labelledby="when-heading">
          <h2 id="when-heading" className="mb-1 font-serif text-xl font-semibold tracking-tight">
            Pick a time
          </h2>
          <SlotPicker
            dates={dates}
            date={date}
            onDateChange={changeDate}
            selected={slot}
            onSelect={setSlot}
            slots={slots}
          />
        </section>

        <section className="grid gap-3" aria-labelledby="resume-heading">
          <h2 id="resume-heading" className="mb-1 font-serif text-xl font-semibold tracking-tight">
            Make it about you
          </h2>
          <Card className="flex items-start gap-4 p-4">
            {tailoring === "available" ? (
              <>
                <Switch
                  id="tailor"
                  checked={tailor}
                  onCheckedChange={setTailor}
                  aria-labelledby="tailor-label"
                  aria-describedby="tailor-help"
                  className="mt-0.5"
                />
                <div className="grid gap-1">
                  <p id="tailor-label" className="font-medium">
                    Ask questions about my résumé
                  </p>
                  <p id="tailor-help" className="text-sm text-muted">
                    Uses <span className="font-medium text-foreground">{resume?.fileName}</span>. The PDF is sent to
                    Google&rsquo;s Gemini API to write the questions. Keep this off if you would rather not share it.
                  </p>
                </div>
              </>
            ) : (
              <div className="grid gap-1">
                <p className="font-medium text-muted">Questions about my résumé</p>
                <p className="text-sm text-muted">
                  {tailoring === "no-resume" ? (
                    <>
                      Upload a PDF first and this option unlocks.{" "}
                      <Link href="/resume" className="font-medium text-primary underline-offset-4 hover:underline">
                        Add your résumé
                      </Link>
                    </>
                  ) : (
                    "This deployment runs without an AI key, so questions come from the built-in bank and cannot use your résumé."
                  )}
                </p>
              </div>
            )}
          </Card>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6" aria-label="Booking summary">
        <Card className="p-5">
          <h2 className="font-serif text-lg font-semibold">Your session</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Topic</dt>
              <dd className="text-right font-medium">{categoryLabel(category)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Level</dt>
              <dd className="text-right font-medium">{DIFFICULTY_META[difficulty].label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">When</dt>
              <dd className="text-right font-medium">
                {slot && slotEnd ? (
                  <>
                    {formatDay(slot)}
                    <br />
                    {formatTimeRange(slot, slotEnd)}
                  </>
                ) : (
                  <span className="font-normal text-faint">Not chosen yet</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Format</dt>
              <dd className="text-right font-medium">
                {QUESTIONS_PER_SESSION} typed answers, about {SLOT_RULES.lengthMinutes} min
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Résumé</dt>
              <dd className="text-right font-medium">{tailor && tailoring === "available" ? "Used" : "Not used"}</dd>
            </div>
          </dl>

          {error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}

          <Button size="lg" className="mt-5 w-full" disabled={!slot} loading={pending} onClick={confirm}>
            Confirm booking
          </Button>
          <p className="mt-3 text-center text-xs text-faint" aria-live="polite">
            {slot
              ? slots.data
                ? `${slots.data.activeBookings} of ${slots.data.maxActiveBookings} upcoming bookings used`
                : " "
              : "Choose a time to continue."}
          </p>
        </Card>
      </aside>
    </div>
  );
}
