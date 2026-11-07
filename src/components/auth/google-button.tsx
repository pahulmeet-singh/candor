import { googleSignInAction } from "@/actions/auth";
import { SubmitButton } from "@/components/shared/submit-button";

/**
 * Only rendered when AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set. A plain
 * <form> bound to a Server Action, so it works without client JavaScript.
 */
export function GoogleButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="grid gap-5">
      <form action={googleSignInAction}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <SubmitButton variant="secondary" size="lg" className="w-full" pendingText="Opening Google">
          Continue with Google
        </SubmitButton>
      </form>
      <div className="flex items-center gap-3 text-xs text-faint" role="separator" aria-label="or">
        <span className="h-px flex-1 bg-line" />
        or use your email
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
