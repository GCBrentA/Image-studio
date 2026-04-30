import type { Response } from "express";
import type { ImageStudioAuthenticatedRequest } from "../middleware/imageStudioAuth";
import {
  addAuditItems,
  completeAuditScan,
  getAuditReport,
  getLatestAuditReport,
  ignoreAuditIssues,
  listAuditScans,
  ImageAuditError,
  listAuditQueueJobs,
  listAuditIssues,
  listAuditItems,
  acknowledgeScheduledAuditRun,
  getAuditSchedule,
  getLatestMonthlyAuditReport,
  queueAuditIssues,
  queueAuditRecommendation,
  startAuditScan,
  upsertAuditSchedule
} from "../services/imageAuditService";
import type { StartImageAuditRequest } from "../types/imageAudit";

const requireAuth = (request: ImageStudioAuthenticatedRequest, response: Response) => {
  if (!request.imageStudioAuth) {
    response.status(401).json({
      status: "error",
      error: "Unauthorized"
    });
    return null;
  }

  return request.imageStudioAuth;
};

const sendError = (response: Response, error: unknown): void => {
  if (error instanceof ImageAuditError) {
    response.status(error.statusCode).json({
      status: "error",
      error: error.message
    });
    return;
  }

  throw error;
};

const logAuditRoute = (
  request: ImageStudioAuthenticatedRequest,
  statusCode: number,
  extra: Record<string, unknown> = {}
): void => {
  console.info(JSON.stringify({
    service: "image-studio-audits",
    method: request.method,
    path: request.originalUrl,
    statusCode,
    storeId: request.imageStudioAuth?.siteId,
    ...extra
  }));
};

export const startImageAudit = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const body = request.body as StartImageAuditRequest;
    const requestedStoreId = typeof body.store_id === "string" && body.store_id.trim()
      ? body.store_id.trim()
      : "";
    const storeId = auth.authType === "site_token"
      ? auth.siteId ?? ""
      : requestedStoreId || (auth.siteId ?? "");

    if (!storeId) {
      response.status(400).json({
        status: "error",
        error: "store_id is required"
      });
      return;
    }

    const result = await startAuditScan(auth, {
      storeId,
      source: typeof body.source === "string" ? body.source : undefined,
      scanOptions: body.scan_options
    });

    logAuditRoute(request, 201, {
      storeId,
      scanId: result.scan_id,
      requestedStoreId: requestedStoreId && requestedStoreId !== storeId ? requestedStoreId : undefined
    });
    response.status(201).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const addImageAuditItems = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const result = await addAuditItems(auth, request.params.scan_id, (request.body as { items?: unknown }).items);
    logAuditRoute(request, 201, { scanId: request.params.scan_id, inserted: result.inserted });
    response.status(201).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const completeImageAudit = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const report = await completeAuditScan(auth, request.params.scan_id);
    logAuditRoute(request, 200, { scanId: request.params.scan_id, status: "completed" });
    response.status(200).json({
      ok: true,
      scan_id: request.params.scan_id,
      status: "completed",
      summary: report,
      ...report
    });
  } catch (error) {
    sendError(response, error);
  }
};

export const getLatestImageAudit = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const storeId = typeof request.query.store_id === "string" && request.query.store_id.trim()
      ? request.query.store_id.trim()
      : auth.siteId ?? "";

    if (!storeId) {
      response.status(400).json({
        status: "error",
        error: "store_id is required"
      });
      return;
    }

    const report = await getLatestAuditReport(auth, storeId);
    response.status(200).json(report);
  } catch (error) {
    sendError(response, error);
  }
};

export const listImageAudits = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const result = await listAuditScans(auth, request.query);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const getImageAuditReport = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const report = await getAuditReport(auth, request.params.scan_id);
    response.status(200).json(report);
  } catch (error) {
    sendError(response, error);
  }
};

export const listImageAuditIssues = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const result = await listAuditIssues(auth, request.params.scan_id, request.query);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const listImageAuditItems = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const result = await listAuditItems(auth, request.params.scan_id, request.query);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const ignoreImageAuditIssues = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const result = await ignoreAuditIssues(auth, request.params.scan_id, (request.body as { issue_ids?: unknown }).issue_ids);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const queueImageAuditIssues = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const body = request.body as { issue_ids?: unknown; background_preset?: unknown; backgroundPreset?: unknown };
    const result = await queueAuditIssues(auth, request.params.scan_id, body.issue_ids, body);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const queueImageAuditRecommendation = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const body = request.body as {
      recommendation_id?: unknown;
      recommendationId?: unknown;
      scan_id?: unknown;
      scanId?: unknown;
      background_preset?: unknown;
      backgroundPreset?: unknown;
    };
    const scanId = request.params.scan_id || String(body.scan_id ?? body.scanId ?? "");
    const recommendationId = body.recommendation_id ?? body.recommendationId;
    const result = await queueAuditRecommendation(auth, scanId, recommendationId, body);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const listImageAuditQueueJobs = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) {
    return;
  }

  try {
    const result = await listAuditQueueJobs(auth, request.query, request.params.scan_id);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const getImageAuditSchedule = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) return;

  try {
    const result = await getAuditSchedule(auth, request.query.store_id);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const saveImageAuditSchedule = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) return;

  try {
    const body = request.body as {
      store_id?: unknown;
      frequency?: unknown;
      scan_mode?: unknown;
      email_report?: unknown;
      scan_options?: unknown;
      monthly_report_enabled?: unknown;
    };
    const result = await upsertAuditSchedule(auth, {
      storeId: body.store_id,
      frequency: body.frequency,
      scanMode: body.scan_mode,
      emailReport: body.email_report,
      scanOptions: body.scan_options,
      monthlyReportEnabled: body.monthly_report_enabled
    });
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const acknowledgeImageAuditSchedule = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) return;

  try {
    const body = request.body as { store_id?: unknown; status?: unknown; scan_id?: unknown; next_scan_at?: unknown };
    const result = await acknowledgeScheduledAuditRun(auth, {
      storeId: body.store_id,
      status: body.status,
      scanId: body.scan_id,
      nextScanAt: body.next_scan_at
    });
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};

export const getImageAuditMonthlyReport = async (
  request: ImageStudioAuthenticatedRequest,
  response: Response
): Promise<void> => {
  const auth = requireAuth(request, response);
  if (!auth) return;

  try {
    const result = await getLatestMonthlyAuditReport(auth, request.query.store_id);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
};
