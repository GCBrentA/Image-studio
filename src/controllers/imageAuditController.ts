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
  listAuditIssues,
  listAuditItems,
  queueAuditIssues,
  queueAuditRecommendation,
  startAuditScan
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
    const storeId = typeof body.store_id === "string" ? body.store_id.trim() : "";

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
    response.status(200).json(report);
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
    const storeId = typeof request.query.store_id === "string" ? request.query.store_id.trim() : "";

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
    const result = await queueAuditIssues(auth, request.params.scan_id, (request.body as { issue_ids?: unknown }).issue_ids);
    response.status(501).json(result);
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
    const body = request.body as { recommendation_id?: unknown };
    const result = await queueAuditRecommendation(auth, request.params.scan_id, body.recommendation_id);
    response.status(501).json(result);
  } catch (error) {
    sendError(response, error);
  }
};
