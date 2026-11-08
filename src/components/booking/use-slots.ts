"use client";

import { useEffect, useState } from "react";
import type { SlotsResponse } from "@/lib/types";

interface Loaded {
  key: string;
  data: SlotsResponse | null;
  error: string | null;
}

export interface SlotsState {
  data: SlotsResponse | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Client-side data fetching (CSR) for one day of slots: the browser calls the
 * `/api/slots` Route Handler whenever the chosen day changes.
 *
 * The result is stored together with the key it was fetched for, and "loading"
 * is derived (`stored key !== wanted key`) instead of being a second piece of
 * state. That avoids setting state synchronously inside the effect, and a late
 * response for a day the user has already left can never overwrite a newer one.
 */
export function useSlots(date: string): SlotsState {
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${date}#${reloads}`;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/slots?date=${encodeURIComponent(date)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const body = (await response.json()) as SlotsResponse & { error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "We could not load the slots.");
        setLoaded({ key, data: body, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoaded({
          key,
          data: null,
          error: error instanceof Error ? error.message : "We could not load the slots.",
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [date, key]);

  const current = loaded?.key === key ? loaded : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: current === null,
    refresh: () => setReloads((count) => count + 1),
  };
}
