import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style class merger: conditional classes via clsx, conflicts resolved by tailwind-merge. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
