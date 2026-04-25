import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export const storageBuckets = {
  originalImages: "original-images",
  processedImages: "processed-images",
  debugCutouts: "debug-cutouts"
} as const;

let supabaseClient: SupabaseClient | null = null;

const getSupabaseClient = (): SupabaseClient => {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new HttpError(503, "Supabase Storage is not configured");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return supabaseClient;
};

export const uploadStorageObject = async ({
  bucket,
  path,
  body,
  contentType
}: {
  bucket: string;
  path: string;
  body: Buffer;
  contentType: string;
}): Promise<void> => {
  const { error } = await getSupabaseClient().storage.from(bucket).upload(path, body, {
    contentType,
    upsert: false
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed for ${bucket}/${path}: ${error.message}`);
  }
};

export const createStorageSignedUrl = async ({
  bucket,
  path,
  expiresInSeconds
}: {
  bucket: string;
  path: string;
  expiresInSeconds: number;
}): Promise<string> => {
  const { data, error } = await getSupabaseClient()
    .storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Supabase Storage signed URL failed for ${bucket}/${path}: ${error?.message ?? "No URL returned"}`);
  }

  return data.signedUrl;
};
