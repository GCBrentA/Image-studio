import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export const storageBuckets = {
  originalImages: "original-images",
  processedImages: "processed-images",
  debugCutouts: "debug-cutouts"
} as const;

let supabaseClient: SupabaseClient | null = null;
let knownBuckets: Set<string> | null = null;

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

const safeSegment = (segment: string): string =>
  segment
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "");

export const normalizeStorageObjectPath = (...segments: string[]): string => {
  const normalized = segments
    .flatMap((segment) => segment.split("/"))
    .map(safeSegment)
    .filter(Boolean);

  if (normalized.length === 0) {
    throw new Error("Storage object path is empty");
  }

  return normalized.join("/");
};

const assertSafeBucket = (bucket: string): string => {
  const safeBucket = safeSegment(bucket);
  if (!safeBucket || safeBucket !== bucket) {
    throw new Error(`Invalid Supabase Storage bucket: ${bucket}`);
  }

  return safeBucket;
};

const normalizeUploadPath = (bucket: string, path: string): string => {
  const safeBucket = assertSafeBucket(bucket);
  const normalizedPath = normalizeStorageObjectPath(path);
  const bucketPrefix = `${safeBucket}/`;

  return normalizedPath === safeBucket
    ? normalizedPath
    : normalizedPath.startsWith(bucketPrefix)
      ? normalizedPath.slice(bucketPrefix.length)
      : normalizedPath;
};

const assertBucketExists = async (bucket: string): Promise<void> => {
  if (!knownBuckets) {
    const { data, error } = await getSupabaseClient().storage.listBuckets();

    if (error) {
      throw new Error(`Supabase Storage bucket validation failed: ${error.message}`);
    }

    knownBuckets = new Set((data ?? []).map((entry) => entry.name));
  }

  if (!knownBuckets.has(bucket)) {
    throw new Error(`Supabase Storage bucket does not exist: ${bucket}`);
  }
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
  const safeBucket = assertSafeBucket(bucket);
  const objectPath = normalizeUploadPath(safeBucket, path);
  await assertBucketExists(safeBucket);

  console.info("Supabase Storage upload", {
    bucket: safeBucket,
    objectPath,
    endpoint: `/storage/v1/object/${safeBucket}/${objectPath}`,
    fileSize: body.byteLength,
    contentType
  });

  const { error } = await getSupabaseClient().storage.from(safeBucket).upload(objectPath, body, {
    contentType,
    upsert: false
  });

  if (error) {
    throw new Error(`Supabase Storage upload failed for ${safeBucket}/${objectPath}: ${error.message}`);
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
  const safeBucket = assertSafeBucket(bucket);
  const objectPath = normalizeUploadPath(safeBucket, path);
  const { data, error } = await getSupabaseClient()
    .storage
    .from(safeBucket)
    .createSignedUrl(objectPath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Supabase Storage signed URL failed for ${safeBucket}/${objectPath}: ${error?.message ?? "No URL returned"}`);
  }

  return data.signedUrl;
};
