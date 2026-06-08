/**
 * Compliance routes (26R1 only) — Rules, Vulnerabilities, DetectedVulnerabilities, DetectedRuleViolations.
 * Extracted from app.ts (P13.0.8).
 */

import type { Express, Request, Response } from 'express';
import type { IProfile } from '../profiles/ProfileManager';
import { resolveEntityData, applyMultiKeywordSearch, parsePage } from './utils';

export function registerComplianceRoutes(app: Express, profile: IProfile): void {

  // GET /v2.0/MobileDeviceRules — alias used by bConnect MCP compliance module
  app.get('/v2.0/MobileDeviceRules', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parseInt(req.query.PageSize as string) || 0;
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'rules', { searchQuery, orderBy, page, pageSize, searchFields: ['ruleName', 'description'] });
      if (!resolved) { res.status(404).json({ error: 'Mobile device rules not available' }); return; }
      const eff = pageSize > 0 ? pageSize : resolved.data.length;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/MobileDeviceRules/:id — alias used by bConnect MCP compliance module
  app.get('/v2.0/MobileDeviceRules/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('rules') as Record<string, unknown>[];
      const item = data.find((r) => r['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Mobile device rule not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Rules
  app.get('/v2.0/Rules', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parseInt(req.query.PageSize as string) || 0;
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'rules', { searchQuery, orderBy, page, pageSize, searchFields: ['ruleName', 'type', 'severity'] });
      if (!resolved) { res.status(404).json({ error: 'Rules not available' }); return; }
      const eff = pageSize > 0 ? pageSize : resolved.data.length;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Rules/:id
  app.get('/v2.0/Rules/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('rules') as Record<string, unknown>[];
      const item = data.find((r) => r['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Rule not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Vulnerabilities
  app.get('/v2.0/Vulnerabilities', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parseInt(req.query.PageSize as string) || 0;
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'vulnerabilities', { searchQuery, orderBy, page, pageSize, searchFields: ['cveId', 'severity', 'description'] });
      if (!resolved) { res.status(404).json({ error: 'Vulnerabilities not available' }); return; }
      const eff = pageSize > 0 ? pageSize : resolved.data.length;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Vulnerabilities/:id
  app.get('/v2.0/Vulnerabilities/:id', (req: Request, res: Response) => {
    try {
      const data = profile.getFixture('vulnerabilities') as Record<string, unknown>[];
      const item = data.find((r) => r['id'] === req.params.id);
      if (!item) { res.status(404).json({ error: 'Vulnerability not found' }); return; }
      res.status(200).json(item);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/DetectedVulnerabilities
  app.get('/v2.0/DetectedVulnerabilities', (req: Request, res: Response) => {
    try {
      let data = profile.getFixture('detectedVulnerabilities') as Record<string, unknown>[];
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['cveId', 'endpointName']); }
      const pageSize = parseInt(req.query.PageSize as string) || data.length;
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Compliance/Endpoints/:id/DetectedVulnerabilities (B1)
  app.get('/v2.0/Compliance/Endpoints/:id/DetectedVulnerabilities', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      let data = profile.getFixture('detectedVulnerabilities') as Record<string, unknown>[];
      data = data.filter((d) => d['endpointId'] === id);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['cveId', 'endpointName']); }
      const pageSize = parseInt(req.query.PageSize as string) || data.length;
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/Compliance/Endpoints/:id/DetectedRuleViolations (B2)
  app.get('/v2.0/Compliance/Endpoints/:id/DetectedRuleViolations', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      let data = profile.getFixture('ruleViolations') as Record<string, unknown>[];
      data = data.filter((d) => d['endpointId'] === id);
      const searchQuery = req.query.SearchQuery as string | undefined;
      if (searchQuery?.trim()) { data = applyMultiKeywordSearch(data, searchQuery, ['ruleName', 'endpointName']); }
      const pageSize = parseInt(req.query.PageSize as string) || data.length;
      const page = parsePage(req.query.Page);
      const startIndex = page * pageSize;
      res.status(200).json({ data: data.slice(startIndex, startIndex + pageSize), pageSize, page, totalItems: data.length });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });

  // GET /v2.0/DetectedRuleViolations
  app.get('/v2.0/DetectedRuleViolations', (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.SearchQuery as string | undefined;
      const orderBy = req.query.OrderBy as string | undefined;
      const pageSize = parseInt(req.query.PageSize as string) || 0;
      const page = parsePage(req.query.Page);
      const resolved = resolveEntityData(profile, 'ruleViolations', { searchQuery, orderBy, page, pageSize, searchFields: ['ruleName', 'endpointName'] });
      if (!resolved) { res.status(404).json({ error: 'Rule violations not available' }); return; }
      const eff = pageSize > 0 ? pageSize : resolved.data.length;
      res.status(200).json({ data: resolved.data, pageSize: eff, page, totalItems: resolved.totalItems });
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); res.status(500).json({ error: 'Internal server error' }); }
  });
}
