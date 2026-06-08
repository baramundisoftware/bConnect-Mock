/**
 * Zod body validation middleware (P10.5 — IT Audit remediation)
 *
 * Validates POST/PUT/PATCH request bodies using Zod:
 *  - Rejects non-object bodies (arrays, strings, null)
 *  - Rejects prototype-pollution keys (__proto__, constructor, prototype)
 *  - Validates required string fields (min length 1)
 *  - Allows all other fields to pass through (mock flexibility)
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// Keys forbidden to prevent prototype pollution attacks.
// Must be checked against the RAW body before Zod processes it,
// because Zod v4 silently strips these keys rather than rejecting them.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Check raw body for prototype-pollution keys using Object.getOwnPropertyNames
 * (which enumerates ALL own keys including non-enumerable ones).
 */
function hasForbiddenKey(body: Record<string, unknown>): string | undefined {
  for (const key of Object.getOwnPropertyNames(body)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return key;
    }
  }
  return undefined;
}

/**
 * Base safe-body schema: validates that each value is accepted.
 * Key-level pollution check is done before Zod (see hasForbiddenKey).
 */
const safeDictSchema = z.record(z.string(), z.unknown());

/**
 * Build a middleware that:
 *  1. Ensures the body is a plain object (not array/null/primitive)
 *  2. Rejects prototype-pollution keys (__proto__, constructor, prototype)
 *  3. Validates required fields are non-empty strings
 */
export function validateWriteBody(required: string[] = []) {
  const schema = safeDictSchema.superRefine((data, ctx) => {
    for (const field of required) {
      const val = data[field];
      if (val === undefined || val === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing required field: ${field}`,
        });
      } else if (typeof val !== 'string') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field "${field}" must be a string`,
        });
      } else if (val.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field "${field}" must not be empty`,
        });
      }
    }
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body;

    // Reject non-object bodies (null, array, string, number, etc.)
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }

    // Reject prototype-pollution keys before Zod processing
    // (Zod v4 silently strips __proto__ etc. instead of rejecting them)
    const forbidden = hasForbiddenKey(body as Record<string, unknown>);
    if (forbidden !== undefined) {
      res.status(400).json({ error: `Field "${forbidden}" is not allowed` });
      return;
    }

    const result = schema.safeParse(body);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Invalid request body';
      res.status(400).json({ error: message });
      return;
    }

    req.body = result.data;
    next();
  };
}

// Pre-built validators for each entity type

/** Endpoints: require displayName as non-empty string */
export const validateEndpointCreate = validateWriteBody(['displayName']);

/** Endpoint PATCH: no required fields, but still safe-key validated */
export const validateEndpointPatch = validateWriteBody([]);

/** Jobs (JobDefinitions): require name */
export const validateJobCreate = validateWriteBody(['name']);

/** Job PATCH: no required fields */
export const validateJobPatch = validateWriteBody([]);

/** JobInstances: require jobDefinitionId and endpointId */
export const validateJobInstanceCreate = validateWriteBody(['jobDefinitionId', 'endpointId']);

/** Assets: require assetTypeId, name, ownerId, ownerType (per OpenAPI AssetForCreation schema) */
export const validateAssetCreate = validateWriteBody(['assetTypeId', 'name', 'ownerId', 'ownerType']);

/** Asset PUT/PATCH: no required fields */
export const validateAssetUpdate = validateWriteBody([]);

/** Variables: require name */
export const validateVariableCreate = validateWriteBody(['name']);

/** Variable PUT/PATCH: no required fields */
export const validateVariableUpdate = validateWriteBody([]);

/** Generic update (PUT/PATCH) — safe-key check only */
export const validateGenericUpdate = validateWriteBody([]);
