"use client";

import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useActionState, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { deleteResumeAction, uploadResumeAction } from "@/actions/resume";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RESUME_MAX_BYTES } from "@/lib/constants/limits";
import { formatBytes, formatDay } from "@/lib/format";
import type { ActionResult, ResumeDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { checkResumeMeta } from "@/lib/validations/resume";

type UploadState = ActionResult<ResumeDTO> | null;

/**
 * Résumé upload and management.
 *
 * The file goes to a Server Action as multipart form data: the browser sends the
 * bytes to our server (never straight to storage), the action validates them and
 * writes them to a private Supabase Storage bucket. The checks here (type and
 * size) only save the user a round trip. The server repeats them and also checks
 * the file's first bytes, because a browser can be lied to.
 */
export function ResumeManager({ resume }: { resume: ResumeDTO | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const pickedIssue = picked ? checkResumeMeta(picked) : null;

  const [state, formAction] = useActionState(
    async (previous: UploadState, formData: FormData): Promise<UploadState> => {
      const result = await uploadResumeAction(previous, formData);
      if (result.ok) {
        setPicked(null);
        toast.success(result.message ?? "Résumé saved.");
      }
      return result;
    },
    null,
  );

  const serverError = state && !state.ok ? (state.fieldErrors?.file?.[0] ?? state.error) : null;
  const error = pickedIssue?.message ?? serverError;

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!file || !inputRef.current) return;
    // Hand the dropped file to the real <input>, so the form submits it like any other choice.
    const transfer = new DataTransfer();
    transfer.items.add(file);
    inputRef.current.files = transfer.files;
    setPicked(file);
  }

  return (
    <div className="grid gap-5">
      {resume ? (
        <Card className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-raised text-primary">
            <FileText className="size-6" aria-hidden="true" />
          </span>
          {/* basis-48 keeps the name readable on a phone: the buttons wrap onto their own line instead of squeezing it. */}
          <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
            <p className="truncate font-medium">{resume.fileName}</p>
            <p className="text-sm text-muted">
              {formatBytes(resume.sizeBytes)} &middot; added {formatDay(resume.uploadedAt)}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <a
              href={`/api/resume/${resume.id}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Download aria-hidden="true" />
              Download
            </a>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="sm">
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
              }
              title="Remove your résumé?"
              description="The file is deleted from storage. Bookings that were set to use it will fall back to the standard questions."
              confirmLabel="Remove résumé"
              onConfirm={async () => {
                const result = await deleteResumeAction();
                if (result.ok) toast.success(result.message ?? "Résumé removed.");
                else toast.error(result.error);
              }}
            />
          </div>
        </Card>
      ) : null}

      <Card className="p-5 sm:p-6">
        <form action={formAction} className="grid gap-4" noValidate>
          <h2 className="font-serif text-lg font-semibold">{resume ? "Replace your résumé" : "Upload your résumé"}</h2>
          <label
            htmlFor="resume-file"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
              error ? "border-coral" : dragging ? "border-primary bg-primary/10" : "border-field hover:bg-raised",
            )}
          >
            <Upload className="size-6 text-primary" aria-hidden="true" />
            <span className="font-medium">
              {picked ? picked.name : resume ? "Choose a new PDF" : "Drop a PDF here, or choose one"}
            </span>
            <span className="text-sm text-muted">
              {picked ? formatBytes(picked.size) : `PDF only, up to ${formatBytes(RESUME_MAX_BYTES)}`}
            </span>
            <input
              ref={inputRef}
              id="resume-file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => setPicked(event.target.files?.[0] ?? null)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "resume-error" : undefined}
            />
          </label>
          {error ? (
            <p id="resume-error" role="alert" className="text-sm text-coral">
              {error}
            </p>
          ) : null}
          <div>
            <SubmitButton disabled={!picked || Boolean(pickedIssue)} pendingText="Uploading">
              <Upload aria-hidden="true" />
              {resume ? "Replace résumé" : "Upload résumé"}
            </SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
