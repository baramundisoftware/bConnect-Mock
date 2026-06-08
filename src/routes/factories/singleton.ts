/**
 * P13.0.7 — Singleton GET route factory.
 *
 * Registers a GET handler for single-object server management resources
 * (Gateway, ManagementServer, VpnAppliance, Dips, etc.) that return a single
 * object rather than a paginated collection.
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../../profiles/ProfileManager';

export interface SingletonConfig {
  /** Route path, e.g. '/v2.0/Gateway' */
  path: string;
  /** Profile fixture key that holds the singleton object or array[0] */
  fixtureKey: string;
  /** Human-readable entity name for error messages */
  entityName: string;
}

/**
 * Register a GET route that returns a single object from a fixture.
 *
 * If the fixture is an array, returns the first element.
 * If the fixture is an object, returns it directly.
 */
export function registerSingleton(
  app: Express,
  profile: IProfile,
  config: SingletonConfig
): void {
  const { path, fixtureKey, entityName } = config;

  app.get(path, (_req: Request, res: Response) => {
    try {
      const data = profile.getFixture(fixtureKey);

      if (Array.isArray(data)) {
        if (data.length === 0) {
          res.status(404).json({ error: `${entityName} not found` });
          return;
        }
        res.status(200).json(data[0]);
        return;
      }

      if (data && typeof data === 'object') {
        res.status(200).json(data);
        return;
      }

      res.status(404).json({ error: `${entityName} not found` });
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
