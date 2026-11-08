import { RESUME_MAX_BYTES, RESUME_MIME } from "@/lib/constants/limits";
import { formatBytes } from "@/lib/format";

/** `%PDF-` at the start of the file. A renamed .exe or .docx will not have it. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;

export type ResumeIssue = { field: "file"; message: string };

/** Checks that need only the file's metadata (also runs in the browser before upload). */
export function checkResumeMeta(file: { name: string; size: number; type: string }): ResumeIssue | null {
  if (file.size === 0) return { field: "file", message: "That file is empty." };
  if (file.size > RESUME_MAX_BYTES) {
    return { field: "file", message: `Keep your résumé under ${formatBytes(RESUME_MAX_BYTES)}. This one is ${formatBytes(file.size)}.` };
  }
  const looksLikePdf = file.type === RESUME_MIME || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) return { field: "file", message: "Upload a PDF file." };
  return null;
}

/** Content check done on the server: never trust the browser's MIME type. */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((byte, i) => bytes[i] === byte);
}

/** A safe display name: strips any path and control characters, caps the length. */
export function cleanFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "resume.pdf";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const name = cleaned === "" ? "resume.pdf" : cleaned;
  return name.length > 120 ? `${name.slice(0, 116)}.pdf` : name;
}
