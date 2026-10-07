/**
 * P13.0.3 — Generic GET /:id route factory.
 *
 * Registers a GET /:id handler that:
 * - Validates the `id` parameter is a valid GUID
 * - Finds the item in the profile fixture array
 * - Returns 200 with the item, or 404 if not found
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../../profiles/ProfileManager';
import { GUID_REGEX } from '../utils';
import { currentRecords } from './currentRecords';

export interface GetByIdConfig {
  /** Base path (without /:id), e.g. '/v2.0/LinuxEndpoints' */
  basePath: string;
  /** Profile fixture key, e.g. 'linuxEndpoints' */
  entityType: string;
  /** Human-readable name for error messages */
  entityName: string;
  /** Whether to skip GUID validation (some entities use non-GUID IDs) */
  skipGuidValidation?: boolean;
}

/**
 * Register a GET /:id route that looks up an entity by ID in profile fixtures.
 *
 * @param app - Express application
 * @param profile - Active IProfile
 * @param config - Route configuration
 */
export function registerGetById(
  app: Express,
  profile: IProfile,
  config: GetByIdConfig
): void {
  const { basePath, entityType, entityName, skipGuidValidation = false } = config;

  app.get(`${basePath}/:id`, (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!id || Array.isArray(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      if (!skipGuidValidation && !GUID_REGEX.test(id)) {
        res.status(400).json({ error: 'Invalid GUID format' });
        return;
      }

      // The store in read-write profiles (created and deleted items), else the fixture
      const data = currentRecords(app, profile, entityType);
      if (!data) {
        res.status(404).json({ error: `${entityName} not found` });
        return;
      }
      const item = data.find((r) => r['id'] === id || r['guid'] === id);

      if (!item) {
        res.status(404).json({ error: `${entityName} not found` });
        return;
      }

      res.status(200).json(item);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
