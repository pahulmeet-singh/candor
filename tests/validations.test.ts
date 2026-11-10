import { test } from "node:test";
import assert from "node:assert/strict";
import { loginSchema, registerSchema, safeCallbackUrl } from "@/lib/validations/auth";
import { bookingSchema, interviewListSchema, slotsQuerySchema } from "@/lib/validations/booking";
import { fieldErrorsOf, firstIssue, formDataToObject } from "@/lib/validations/common";
import { feedbackFilterSchema } from "@/lib/validations/feedback";
import { cleanFileName, checkResumeMeta, hasPdfSignature } from "@/lib/validations/resume";
import { generatedQuestionsSchema, saveAnswerSchema } from "@/lib/validations/session";
import { RESUME_MAX_BYTES } from "@/lib/constants/limits";

test("registerSchema normalises the email and enforces password rules", () => {
  const ok = registerSchema.safeParse({ name: "  Aarav Mehta ", email: "  Aarav@Example.COM ", password: "Password123" });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.data.name, "Aarav Mehta");
    assert.equal(ok.data.email, "aarav@example.com");
  }

  const weak = registerSchema.safeParse({ name: "A", email: "nope", password: "short" });
  assert.equal(weak.success, false);
  if (!weak.success) {
    const errors = fieldErrorsOf(weak.error);
    assert.ok(errors.name?.length);
    assert.ok(errors.email?.length);
    assert.ok(errors.password?.length);
  }

  assert.equal(registerSchema.safeParse({ name: "Aarav", email: "a@b.co", password: "allletters" }).success, false);
  assert.equal(registerSchema.safeParse({ name: "Aarav", email: "a@b.co", password: "12345678" }).success, false);
  assert.equal(registerSchema.safeParse({ name: "Aarav", email: "a@b.co", password: "a1".repeat(40) }).success, false);
});

test("loginSchema only requires a non-empty password", () => {
  assert.equal(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success, true);
  assert.equal(loginSchema.safeParse({ email: "a@b.co", password: "" }).success, false);
});

test("safeCallbackUrl rejects open redirects", () => {
  assert.equal(safeCallbackUrl("/interviews/abc"), "/interviews/abc");
  assert.equal(safeCallbackUrl("//evil.example"), "/dashboard");
  assert.equal(safeCallbackUrl("https://evil.example"), "/dashboard");
  assert.equal(safeCallbackUrl("/\\evil.example"), "/dashboard");
  assert.equal(safeCallbackUrl(null), "/dashboard");
  assert.equal(safeCallbackUrl(undefined, "/feedback"), "/feedback");
});

test("safeCallbackUrl rejects control characters that browsers strip from URLs", () => {
  // The WHATWG URL parser deletes tabs and newlines, so these would otherwise become "//evil.example".
  assert.equal(safeCallbackUrl("/\t/evil.example"), "/dashboard");
  assert.equal(safeCallbackUrl("/\n/evil.example"), "/dashboard");
  assert.equal(safeCallbackUrl("/\r/evil.example"), "/dashboard");
  // A percent-encoded tab stays a path segment on this site, so it is harmless.
  assert.equal(safeCallbackUrl("/%09/evil.example"), "/%09/evil.example");
});

test("passwords are capped in bytes, because bcrypt reads only the first 72", () => {
  const base = { name: "Aarav", email: "a@b.co" };
  const fits = "अ".repeat(23) + "a1"; // 25 characters, 71 bytes
  const tooLong = "अ".repeat(24) + "a1"; // 26 characters, 74 bytes
  assert.equal(registerSchema.safeParse({ ...base, password: fits }).success, true);
  assert.equal(registerSchema.safeParse({ ...base, password: tooLong }).success, false);
  assert.equal(loginSchema.safeParse({ email: base.email, password: tooLong }).success, false);
});

test("bookingSchema parses a valid booking and rejects bad input", () => {
  const ok = bookingSchema.safeParse({
    category: "FRONTEND",
    difficulty: "BEGINNER",
    scheduledAt: "2026-11-02T04:30:00.000Z",
  });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.ok(ok.data.scheduledAt instanceof Date);
    assert.equal(ok.data.useResume, false);
  }
  assert.equal(bookingSchema.safeParse({ category: "COOKING", difficulty: "BEGINNER", scheduledAt: "2026-11-02T04:30:00Z" }).success, false);
  assert.equal(bookingSchema.safeParse({ category: "DSA", difficulty: "EXPERT", scheduledAt: "2026-11-02T04:30:00Z" }).success, false);
  assert.equal(bookingSchema.safeParse({ category: "DSA", difficulty: "ADVANCED", scheduledAt: "tomorrow" }).success, false);
  assert.equal(bookingSchema.safeParse({ category: "DSA", difficulty: "ADVANCED", scheduledAt: "2026-11-02T10:00:00" }).success, false);
});

test("slotsQuerySchema needs a real date", () => {
  assert.equal(slotsQuerySchema.safeParse({ date: "2026-11-02" }).success, true);
  assert.equal(slotsQuerySchema.safeParse({ date: "2026-02-31" }).success, false);
  assert.equal(slotsQuerySchema.safeParse({}).success, false);
});

test("list and filter schemas fall back to defaults instead of failing", () => {
  assert.deepEqual(interviewListSchema.parse({}), { tab: "upcoming", page: 1 });
  assert.deepEqual(interviewListSchema.parse({ tab: "nonsense", page: "-4" }), { tab: "upcoming", page: 1 });
  assert.deepEqual(interviewListSchema.parse({ tab: "past", page: "3" }), { tab: "past", page: 3 });

  const filters = feedbackFilterSchema.parse({ category: "NOPE", range: "ever", sort: "random", page: "abc" });
  assert.deepEqual(filters, { category: undefined, range: "all", sort: "recent", page: 1 });
  assert.equal(feedbackFilterSchema.parse({ category: "DSA", range: "30d", sort: "score_desc", page: "2" }).category, "DSA");
});

test("checkResumeMeta enforces size and type", () => {
  assert.equal(checkResumeMeta({ name: "cv.pdf", size: 1000, type: "application/pdf" }), null);
  assert.equal(checkResumeMeta({ name: "CV.PDF", size: 1000, type: "" }), null);
  assert.ok(checkResumeMeta({ name: "cv.pdf", size: 0, type: "application/pdf" }));
  assert.ok(checkResumeMeta({ name: "cv.pdf", size: RESUME_MAX_BYTES + 1, type: "application/pdf" }));
  assert.ok(checkResumeMeta({ name: "cv.docx", size: 1000, type: "application/msword" }));
});

test("hasPdfSignature checks the magic bytes", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\n...");
  const exe = new TextEncoder().encode("MZ\u0090\u0000");
  assert.equal(hasPdfSignature(pdf), true);
  assert.equal(hasPdfSignature(exe), false);
  assert.equal(hasPdfSignature(new Uint8Array([0x25, 0x50])), false);
});

test("cleanFileName strips paths and control characters", () => {
  assert.equal(cleanFileName("C:\\Users\\me\\My CV.pdf"), "My CV.pdf");
  assert.equal(cleanFileName("../../etc/passwd.pdf"), "passwd.pdf");
  assert.equal(cleanFileName("bad\u0000name.pdf"), "badname.pdf");
  assert.equal(cleanFileName(""), "resume.pdf");
  assert.ok(cleanFileName(`${"a".repeat(300)}.pdf`).length <= 120);
});

test("saveAnswerSchema and generatedQuestionsSchema", () => {
  assert.equal(saveAnswerSchema.safeParse({ interviewId: "ckabc12345", questionId: "q1", text: "hello" }).success, true);
  assert.equal(saveAnswerSchema.safeParse({ interviewId: "x", questionId: "q1", text: "hello" }).success, false);
  assert.equal(saveAnswerSchema.safeParse({ interviewId: "ckabc12345", questionId: "q1", text: "a".repeat(4001) }).success, false);

  const five = Array.from({ length: 5 }, (_, i) => ({ text: `Explain the concept number ${i + 1} in detail.`, topic: "Topic" }));
  assert.equal(generatedQuestionsSchema.safeParse({ questions: five }).success, true);
  assert.equal(generatedQuestionsSchema.safeParse({ questions: five.slice(0, 4) }).success, false);
});

test("form helpers", () => {
  const form = new FormData();
  form.set("email", "a@b.co");
  form.set("$ACTION_ID_123", "internal");
  assert.deepEqual(formDataToObject(form), { email: "a@b.co" });

  const parsed = loginSchema.safeParse({ email: "bad", password: "" });
  assert.equal(parsed.success, false);
  if (!parsed.success) assert.ok(firstIssue(parsed.error).length > 0);
});
