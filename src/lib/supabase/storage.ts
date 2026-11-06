import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { RESUME_MAX_BYTES, RESUME_MIME, SIGNED_URL_TTL_SECONDS } from "@/lib/constants/limits";

/**
 * Résumé storage on Supabase Storage.
 *
 * The bucket is private and is only ever touched from the server with the
 * service-role key. Browsers never get a bucket URL: they get a link that
 * is valid for one minute, created after we have checked the file belongs to them.
 */

let cached: SupabaseClient | null = null;
let bucketReady: Promise<void> | null = null;

function admin(): SupabaseClient {
  const url = env.supabaseUrl;
  const key = env.supabaseServiceRoleKey;
  if (!url || !key) {
    throw new AppError("STORAGE_ERROR", "File storage is not configured on this server (see docs/DEPLOYMENT.md).");
  }
  cached ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

/** Creates the private bucket on first use. Safe to call on every upload. */
async function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const supabase = admin();
    const existing = await supabase.storage.getBucket(env.resumeBucket);
    if (existing.data) return;
    const created = await supabase.storage.createBucket(env.resumeBucket, {
      public: false,
      fileSizeLimit: RESUME_MAX_BYTES,
      allowedMimeTypes: [RESUME_MIME],
    });
    // Another instance may have created it between our two calls.
    if (created.error && !/already exists/i.test(created.error.message)) throw created.error;
  })().catch((error: unknown) => {
    bucketReady = null; // try again on the next upload
    throw error;
  });
  return bucketReady;
}

function storageError(action: string, error: unknown): AppError {
  logger.error("storage.failed", { action, error });
  return new AppError("STORAGE_ERROR", "We could not reach file storage. Please try again in a moment.", { cause: error });
}

export async function putResume(path: string, bytes: Uint8Array): Promise<void> {
  try {
    await ensureBucket();
    const { error } = await admin().storage.from(env.resumeBucket).upload(path, bytes, {
      contentType: RESUME_MIME,
      upsert: false,
    });
    if (error) throw error;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw storageError("put", error);
  }
}

/** Deleting a missing object is not an error, so cleanup can be retried freely. */
export async function deleteResume(path: string): Promise<void> {
  try {
    const { error } = await admin().storage.from(env.resumeBucket).remove([path]);
    if (error) throw error;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw storageError("delete", error);
  }
}

export async function signedResumeUrl(path: string, fileName: string): Promise<string> {
  try {
    const { data, error } = await admin()
      .storage.from(env.resumeBucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: fileName });
    if (error || !data) throw error ?? new Error("No signed URL returned");
    return data.signedUrl;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw storageError("sign", error);
  }
}

export async function readResume(path: string): Promise<Uint8Array> {
  try {
    const { data, error } = await admin().storage.from(env.resumeBucket).download(path);
    if (error || !data) throw error ?? new Error("Empty download");
    return new Uint8Array(await data.arrayBuffer());
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw storageError("read", error);
  }
}
