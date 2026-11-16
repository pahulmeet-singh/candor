import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** The ids a control should reference with `aria-describedby`, so hints and errors are read aloud with it. */
export function describedBy(id, state) {
  const ids = [state.hint && !state.error ? `${id}-hint` : null, state.error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function Field({ label, htmlFor, hint, error, optional, className, children }) {
  const messages = Array.isArray(error) ? error : error ? [error] : [];
  const message = messages[0];

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional ? <span className="text-xs text-faint">Optional</span> : null}
      </div>
      {children}
      {message ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[0.8125rem] font-medium text-coral">
          {message}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
