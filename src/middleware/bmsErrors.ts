/**
 * bmsErrors — error answers in the shape a live bMS sends (26R1, checked 2026-10-07)
 *
 * A live bMS answers errors as problem details:
 *   404 unknown ID     application/problem+json  {"type":"https://httpstatuses.io/404",
 *                      "title":"Object [<id>] not found or not visible due to missing rights.",
 *                      "status":404,"traceId":"00-…"}
 *   400 validation     application/json          {"type":"https://httpstatuses.io/400",
 *                      "title":"One or more validation errors occurred.","status":400,
 *                      "errors":{"<field>":["…"]},"traceId":"00-…"}
 *   401, 405, …        application/problem+json  {"type","title","status","traceId"}
 *
 * The mock's handlers answer errors as {"error": "<message>"}. bmsErrorBodies rewrites every
 * such body into the bMS shape, and moves the message into the X-BConnect-Mock-Reason header
 * (and the request log), since the bMS explains nothing.
 */

import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/** Response header with the mock's explanation of an error; a live bMS sends nothing like it */
export const MOCK_REASON_HEADER = 'X-BConnect-Mock-Reason';

/** res.locals key under which the module routing guard stores the matched spec route */
export const ROUTE_LOCAL = 'bconnectRoute';

/** The spec route a request matched: its path parameters and request body schema */
export interface MatchedRoute {
  params: Record<string, string>;
  body?: string;
  /** The spec's response shape of the route (specProjection) */
  shape?: import('../generated/moduleRoutes').ResponseShape;
}

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const TITLES: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  405: 'Method Not Allowed', 409: 'Conflict', 413: 'Payload Too Large',
  415: 'Unsupported Media Type', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 501: 'Not Implemented', 503: 'Service Unavailable',
};

export const VALIDATION_TITLE = 'One or more validation errors occurred.';

/** A W3C trace id, as the bMS puts into its problem details */
export function traceId(): string {
  return `00-${randomBytes(16).toString('hex')}-${randomBytes(8).toString('hex')}-00`;
}

function problemBody(status: number, title: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: `https://httpstatuses.io/${status}`, title, status, ...extra, traceId: traceId() };
}

/** Problem details (application/problem+json), as the bMS answers 401, 404, 405 and others */
export function sendProblem(res: Response, status: number, reason: string, title = TITLES[status] ?? 'Error'): void {
  res.setHeader(MOCK_REASON_HEADER, reason);
  res.status(status).type('application/problem+json').send(JSON.stringify(problemBody(status, title)));
}

/**
 * A 404 with a detail message (application/json, title "Not Found"), as the bMS answers some
 * typed lookups: hidden tree roots ("job folder [ID] not found …") and Microservices.
 */
export function sendNotFoundDetail(res: Response, reason: string, detail: string): void {
  res.setHeader(MOCK_REASON_HEADER, reason);
  res.status(404).type('application/json').send(JSON.stringify(problemBody(404, 'Not Found', { detail })));
}

/** A 400 validation answer (application/json), as the bMS answers invalid IDs and bodies */
export function sendValidationProblem(res: Response, errors: Record<string, string[]>, reason: string): void {
  res.setHeader(MOCK_REASON_HEADER, reason);
  res.status(400).type('application/json').send(JSON.stringify(problemBody(400, VALIDATION_TITLE, { errors })));
}

/** The 404 title for a path: the bMS names the requested ID */
export function notFoundTitle(path: string): string {
  const ids = path.match(GUID);
  const id = ids ? ids[ids.length - 1] : undefined;
  return id ? `Object [${id}] not found or not visible due to missing rights.` : 'Not Found';
}

/** The action parameter the bMS names for a body: LogicalGroupForCreation → logicalGroup */
export function bodyParameterName(schema: string): string {
  const base = schema.replace(/(ForCreation|ForUpdate)$/, '');
  return base.charAt(0).toLowerCase() + base.slice(1);
}

/** The bMS's errors for a body it can't read: the reason under "$", the body parameter as required */
export function bodyErrors(message: string, schema?: string): Record<string, string[]> {
  const errors: Record<string, string[]> = { $: [message] };
  if (schema && schema !== 'JsonPatchDocument') {
    const param = bodyParameterName(schema);
    errors[param] = [`The ${param} field is required.`];
  }
  return errors;
}

const INVALID_ID = /invalid .*(id|guid)|(id|guid).* (format|invalid)|not a valid guid/i;
const MISSING_FIELD = /^Missing required field: (.+)$/;

/** The errors object for a mock 400 message, in the bMS's validation shape */
function validationErrors(message: string, req: Request, route: MatchedRoute | undefined): Record<string, string[]> {
  if (INVALID_ID.test(message)) {
    const param = route ? Object.entries(route.params).find(([, v]) => !new RegExp(`^${GUID.source}$`, 'i').test(v)) : undefined;
    const value = param ? param[1] : (req.path.split('/').filter(Boolean).pop() ?? '');
    return { [param ? param[0] : 'id']: [`The value '${value}' is not valid.`] };
  }
  const missing = MISSING_FIELD.exec(message);
  if (missing) {
    const type = route?.body ?? 'request body';
    return bodyErrors(`JSON deserialization for type '${type}' was missing required properties including: '${missing[1]}'.`, route?.body);
  }
  return { $: [message] };
}

/** True for the mock's own error bodies: { error: "…" }, maybe with extra fields */
function isMockError(body: unknown): body is { error: string } {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    && typeof (body as Record<string, unknown>)['error'] === 'string' && !('type' in body);
}

/** Rewrite every {"error": …} answer into the bMS's error shape */
export function bmsErrorBodies(req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = (body?: unknown) => {
    if (res.statusCode < 400 || !isMockError(body)) { return json(body); }
    const status = res.statusCode;
    const message = body.error;
    const route = res.locals[ROUTE_LOCAL] as MatchedRoute | undefined;
    if (status === 400) {
      sendValidationProblem(res, validationErrors(message, req, route), message);
    } else if (status === 404) {
      sendProblem(res, 404, message, (body as { bareNotFound?: boolean }).bareNotFound ? 'Not Found' : notFoundTitle(req.path));
    } else {
      sendProblem(res, status, message);
    }
    return res;
  };
  next();
}
