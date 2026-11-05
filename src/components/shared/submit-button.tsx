"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * A submit button that knows whether its own <form> is submitting.
 * `useFormStatus` reads the status of the nearest parent form, so this works
 * with `<form action={serverAction}>` without any state in the page.
 */
export function SubmitButton({ children, pendingText, ...props }: Omit<ButtonProps, "type"> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
