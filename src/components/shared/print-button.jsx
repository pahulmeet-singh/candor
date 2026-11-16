"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog; "Save as PDF" is one of its destinations. The print stylesheet is in globals.css. */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      Print or save as PDF
    </Button>
  );
}
