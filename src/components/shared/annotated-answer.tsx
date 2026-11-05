import { annotateAnswer } from "@/lib/annotate";
import { cn } from "@/lib/utils";
import type { Annotation } from "@/lib/validations/feedback";

interface AnnotatedAnswerProps {
  answer: string;
  annotations: readonly Annotation[];
}

/**
 * The signature view of the product: the candidate's own answer with a
 * highlighter drawn over the words the feedback is about. Each highlight
 * carries a small number that matches a note underneath, and the notes say
 * "Strength" or "Gap" in words, so nothing depends on colour alone.
 *
 * Server-rendered and free of client JavaScript, so it also works inside the
 * report modal, in print, and with scripting disabled.
 */
export function AnnotatedAnswer({ answer, annotations }: AnnotatedAnswerProps) {
  if (answer.trim() === "") {
    return <p className="text-sm text-muted italic">No answer was written for this question.</p>;
  }

  const { segments, unmatched } = annotateAnswer(answer, annotations);

  return (
    <div className="grid gap-4">
      <p className="prose-reading whitespace-pre-wrap">
        {segments.map((segment, index) =>
          segment.annotation === null ? (
            <span key={index}>{segment.text}</span>
          ) : (
            <mark key={index} className="hl" data-kind={annotations[segment.annotation].kind}>
              {segment.text}
              <sup>{segment.annotation + 1}</sup>
            </mark>
          ),
        )}
      </p>

      {annotations.length > 0 ? (
        <ol className="grid gap-2.5 text-sm">
          {annotations.map((annotation, index) => (
            <li key={index} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold",
                  annotation.kind === "strength" ? "bg-primary/20 text-primary" : "bg-coral/20 text-coral",
                )}
              >
                {index + 1}
              </span>
              <div className="grid gap-0.5">
                <p className="text-muted">
                  <span className={cn("font-semibold", annotation.kind === "strength" ? "text-primary" : "text-coral")}>
                    {annotation.kind === "strength" ? "Strength. " : "Gap. "}
                  </span>
                  {annotation.note}
                </p>
                {unmatched.includes(index) ? (
                  <p className="text-[0.8125rem] text-faint italic">About: &ldquo;{annotation.quote}&rdquo;</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
