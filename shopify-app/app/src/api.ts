export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || body.message || "Request failed");
  }

  return response.json() as Promise<T>;
}

export type DashboardSummary = {
  productsScanned: number;
  imagesQueued: number;
  imagesProcessed: number;
  pendingReview: number;
  creditsRemaining: number;
};

export type ProductRow = {
  id: string;
  shopifyProductId: string;
  title: string;
  status: string;
  imageCount: number;
  mainImageUrl: string | null;
  mainMediaId: string | null;
};

export type ImageJob = {
  id: string;
  shopifyProductId: string;
  shopifyMediaId: string | null;
  sourceImageUrl: string;
  generatedImageUrl: string | null;
  status: string;
  errorMessage: string | null;
  prompt: string | null;
  mode: string | null;
};
