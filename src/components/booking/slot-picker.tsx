"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayParts, formatTime } from "@/lib/format";
import { dayStart } from "@/lib/slots";
import type { SlotDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { SlotsState } from "./use-slots";

interface SlotPickerProps {
  /** IST calendar dates the user may browse, today first. */
  dates: string[];
  date: string;
  onDateChange: (date: string) => void;
  /** ISO start of the chosen slot. */
  selected: string | null;
  onSelect: (start: string) => void;
  slots: SlotsState;
}

function caption(slot: SlotDTO): string {
  switch (slot.state) {
    case "open":
      return `${slot.capacity - slot.booked} of ${slot.capacity} left`;
    case "full":
      return "Full";
    case "mine":
      return "Booked by you";
    case "closed":
      return "Closed";
  }
}

/**
 * Day strip plus slot grid. Both are native radio groups: the browser supplies
 * arrow-key navigation and screen-reader semantics, and the styling hangs off
 * the `peer` selector, so there is no ARIA to get wrong.
 */
export function SlotPicker({ dates, date, onDateChange, selected, onSelect, slots }: SlotPickerProps) {
  const { data, error, loading, refresh } = slots;
  const nothingToBook = data !== null && data.slots.every((slot) => slot.state !== "open");

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      {/* A fieldset's default minimum width is its content width, so it needs min-w-0 to let the strip scroll. */}
      <fieldset className="min-w-0">
        <legend className="sr-only">Day</legend>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-2">
          {dates.map((key, index) => {
            const parts = formatDayParts(dayStart(key));
            return (
              // `relative` makes the label the containing block of its visually hidden radio. Without it the
              // radio is positioned against the page, escapes this scroller, and makes the whole page scroll sideways.
              <label key={key} className="relative shrink-0">
                <input
                  type="radio"
                  name="day"
                  value={key}
                  checked={key === date}
                  onChange={() => onDateChange(key)}
                  className="peer sr-only"
                />
                <span className="flex w-[4.5rem] cursor-pointer flex-col items-center rounded-lg border border-line bg-surface py-2 leading-tight transition-colors hover:bg-raised peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                  <span className="text-xs text-muted">{index === 0 ? "Today" : parts.weekday}</span>
                  <span className="font-serif text-xl font-semibold tabular-nums">{parts.day}</span>
                  <span className="text-xs text-muted">{parts.month}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" aria-label="Loading slots">
            {Array.from({ length: 16 }, (_, index) => (
              <Skeleton key={index} className="h-[3.25rem]" />
            ))}
          </div>
        ) : error ? (
          <Alert tone="danger" title="Could not load the slots">
            <span className="block">{error}</span>
            <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
              Try again
            </Button>
          </Alert>
        ) : data ? (
          <fieldset>
            <legend className="sr-only">Time slot</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {data.slots.map((slot) => {
                const selectable = slot.state === "open";
                return (
                  <label key={slot.start} className={selectable ? "cursor-pointer" : "cursor-not-allowed"}>
                    <input
                      type="radio"
                      name="slot"
                      value={slot.start}
                      disabled={!selectable}
                      checked={selected === slot.start}
                      onChange={() => onSelect(slot.start)}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        "flex flex-col rounded-lg border px-3 py-2 leading-tight transition-colors",
                        "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
                        selectable
                          ? "border-line bg-surface hover:bg-raised peer-checked:border-primary peer-checked:bg-primary/10"
                          : "border-line/60 text-faint",
                        slot.state === "mine" && "border-sky/40 text-sky",
                      )}
                    >
                      <span className="font-medium tabular-nums">{formatTime(slot.start)}</span>
                      <span className={cn("text-xs", selectable ? "text-muted" : "text-faint")}>{caption(slot)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {nothingToBook ? (
              <p className="mt-3 text-sm text-muted">Nothing is open on this day. Try another one.</p>
            ) : null}
          </fieldset>
        ) : null}
      </div>

      <p className="text-xs text-faint">
        Times are India Standard Time (UTC+5:30). Each slot has {data?.slots[0]?.capacity ?? 3} seats, and bookings
        close 30 minutes before the start.
      </p>
    </div>
  );
}
