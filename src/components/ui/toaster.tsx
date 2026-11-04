"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

/** Sonner toasts, themed with the same tokens as the rest of the app. */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      style={
        {
          "--normal-bg": "var(--raised)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--line-strong)",
          "--success-bg": "var(--raised)",
          "--success-text": "var(--sage)",
          "--success-border": "var(--line-strong)",
          "--error-bg": "var(--raised)",
          "--error-text": "var(--coral)",
          "--error-border": "var(--line-strong)",
          fontFamily: "var(--font-sans)",
        } as CSSProperties
      }
    />
  );
}
