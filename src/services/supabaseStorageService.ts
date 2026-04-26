import { env } from "../config/env";
import { HttpError } from "../utils/httpError";

export const storageBuckets = {
  originalImages: "original-images",
  processedImages: "processed-images",
  debugCutouts: "debug-cutouts"
} as const;

let warnedAboutSupabaseUrlFallback = false;
const knownBuckets = new Set<string>();
const knownStorageBucketIds = new Set<string>(Object.values(storageBuckets));

const normalizeSupabaseProjectUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/\/rest\/v1$/i, "");
};

export const getSupabaseStorageBaseUrl = (): string => {
  const projectUrl = normalizeSupabaseProjectUrl(env.supabaseProjectUrl);

  if (projectUrl) {
    return projectUrl;
  }

  const fallbackUrl = normalizeSupabaseProjectUrl(env.supabaseUrl);

  if (fallbackUrl && !warnedAboutSupabaseUrlFallback) {
    console.warn("SUPABASE_PROJECT_URL is not set. Using normalized SUPABASE_URL for Storage; set SUPABASE_PROJECT_URL directly in Render.");
    warnedAboutSupabaseUrlFallback = true;
  }

  return fallbackUrl;
};

const assertStorageConfigured = (): void => {
  if (!getSupabaseStorageBaseUrl() || !env.supabaseServiceRoleKey) {
    throw new HttpError(503, "Supabase Storage is not configured");
  }
};

const assertValidStorageBaseUrl = (baseUrl: string): void => {
  try {
    const parsedUrl = new URL(baseUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.pathname.replace(/\/+$/, "") !== "") {
      throw new Error("Invalid Supabase project URL");
    }
  } catch {
    throw new HttpError(503, "SUPABASE_PROJECT_URL must be a Supabase project base URL such as https://xxxx.supabase.co");
  }
};

const sanitizePathSegment = (segment: string): string =>
  segment
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "");

const assertNotFullUrl = (value: string): void => {
  if (/^https?:\/\//i.test(value.trim())) {
    throw new Error("Storage object path must not be a full URL");
  }
};

const encodeObjectPath = (objectPath: string): string =>
  objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const normalizeStorageObjectPath = (...segments: string[]): string => {
  const normalized = segments
    .flatMap((segment) => {
      assertNotFullUrl(segment);
      const trimmed = segment.trim();

      if (trimmed.includes("//")) {
        throw new Error("Storage object path must not contain double slashes");
      }

      return trimmed.replace(/^\/+|\/+$/g, "").split("/");
    })
    .map(sanitizePathSegment)
    .filter(Boolean);

  if (normalized.length === 0) {
    throw new Error("Storage object path is empty");
  }

  if (knownStorageBucketIds.has(normalized[0])) {
    normalized.shift();
  }

  const objectPath = normalized.join("/");

  if (!objectPath || objectPath.startsWith("/") || objectPath.includes("//")) {
    throw new Error(`Invalid Supabase Storage object path: ${objectPath}`);
  }

  return objectPath;
};

const assertSafeBucket = (bucket: string): string => {
  const trimmed = bucket.trim();

  if (!trimmed) {
    throw new Error("Supabase Storage bucket is empty");
  }

  if (trimmed.includes("/") || /^https?:\/\//i.test(trimmed)) {
    throw new Error(`Invalid Supabase Storage bucket: ${bucket}`);
  }

  const safeBucket = sanitizePathSegment(trimmed);

  if (!safeBucket || safeBucket !== trimmed) {
    throw new Error(`Invalid Supabase Storage bucket: ${bucket}`);
  }

  return safeBucket;
};

const normalizeUploadPath = (bucket: string, path: string): string => {
  const safeBucket = assertSafeBucket(bucket);
  const objectPath = normalizeStorageObjectPath(path);
  const bucketPrefix = `${safeBucket}/`;

  if (objectPath === safeBucket) {
    throw new Error("Storage object path must include a file path inside the bucket");
  }

  return objectPath.startsWith(bucketPrefix)
    ? objectPath.slice(bucketPrefix.length)
    : objectPath;
};

const storageHeaders = (contentType?: string): HeadersInit => ({
  apikey: env.supabaseServiceRoleKey,
  authorization: `Bearer ${env.supabaseServiceRoleKey}`,
  ...(contentType ? { "content-type": contentType } : {})
});

const getStorageEndpoint = (endpointPath: string): string => {
  const baseUrl = getSupabaseStorageBaseUrl();
  assertValidStorageBaseUrl(baseUrl);

  return `${baseUrl}${endpointPath}`;
};

const logStorageOperation = ({
  bucket,
  objectPath,
  endpointPath
}: {
  bucket: string;
  objectPath?: string;
  endpointPath: string;
}): void => {
  console.info("Supabase Storage", {
    storageBaseUrl: getSupabaseStorageBaseUrl(),
    bucket,
    ...(objectPath ? { objectPath } : {}),
    endpointPath
  });
};

const assertBucketExists = async (bucket: string): Promise<void> => {
  const safeBucket = assertSafeBucket(bucket);

  if (knownBuckets.has(safeBucket)) {
    return;
  }

  assertStorageConfigured();

  const endpointPath = `/storage/v1/bucket/${encodeURIComponent(safeBucket)}`;
  logStorageOperation({
    bucket: safeBucket,
    endpointPath
  });

  const response = await fetch(getStorageEndpoint(endpointPath), {
    method: "GET",
    headers: storageHeaders()
  });

  if (!response.ok) {
    throw new Error(`Supabase Storage bucket validation failed for ${safeBucket}: ${response.status} ${response.statusText}`);
  }

  knownBuckets.add(safeBucket);
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

  const endpointPath = `/storage/v1/object/${encodeURIComponent(safeBucket)}/${encodeObjectPath(objectPath)}`;
  logStorageOperation({
    bucket: safeBucket,
    objectPath,
    endpointPath
  });

  const response = await fetch(getStorageEndpoint(endpointPath), {
    method: "POST",
    headers: {
      ...storageHeaders(contentType),
      "x-upsert": "false"
    },
    body: body as unknown as BodyInit
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase Storage upload failed for ${safeBucket}/${objectPath}: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`);
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
  await assertBucketExists(safeBucket);

  const endpointPath = `/storage/v1/object/sign/${encodeURIComponent(safeBucket)}/${encodeObjectPath(objectPath)}`;
  const response = await fetch(getStorageEndpoint(endpointPath), {
    method: "POST",
    headers: storageHeaders("application/json"),
    body: JSON.stringify({
      expiresIn: expiresInSeconds
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Supabase Storage signed URL failed for ${safeBucket}/${objectPath}: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`);
  }

  const data = await response.json() as { signedURL?: string; signedUrl?: string; signedURLPath?: string };
  const signedPath = data.signedURL ?? data.signedUrl ?? data.signedURLPath;

  if (!signedPath) {
    throw new Error(`Supabase Storage signed URL failed for ${safeBucket}/${objectPath}: No URL returned`);
  }

  if (signedPath.startsWith("http")) {
    return signedPath;
  }

  const normalizedSignedPath = signedPath.startsWith("/") ? signedPath : `/${signedPath}`;
  const storagePath = normalizedSignedPath.startsWith("/storage/v1/")
    ? normalizedSignedPath
    : `/storage/v1${normalizedSignedPath}`;

  return `${getSupabaseStorageBaseUrl()}${storagePath}`;
};
