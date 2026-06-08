/**
 * In-memory state manager for readwrite profiles
 * Manages CRUD operations on all entity types.
 *
 * Concurrency Strategy:
 * - Node.js single-threaded event loop provides natural atomicity for Map operations
 * - randomUUID() from crypto module is cryptographically random (no collisions)
 * - "Last write wins" semantics for concurrent updates (no locking needed)
 * - DELETE operations are idempotent (safe for concurrent calls)
 */

import { randomUUID } from 'crypto';

/**
 * Generic entity — must have at least an `id` field.
 */
export interface Entity {
  id?: string;
  guid?: string;
  [key: string]: unknown;
}

/**
 * Windows endpoint interface
 */
interface WindowsEndpoint extends Entity {
  displayName: string;
  operatingSystem?: string;
  primaryUser?: string;
  type?: string;
}

/**
 * All fixtures needed to initialize a standard-readwrite state manager.
 */
export interface StateManagerFixtures {
  windowsEndpoints?: WindowsEndpoint[];
  androidEndpoints?: Entity[];
  linuxEndpoints?: Entity[];
  macEndpoints?: Entity[];
  iosEndpoints?: Entity[];
  networkEndpoints?: Entity[];
  industrialEndpoints?: Entity[];
  logicalGroups?: Entity[];
  jobs?: Entity[];
  jobInstances?: Entity[];
  assets?: Entity[];
  variables?: Entity[];
}

/**
 * Generic typed store for any entity collection.
 * Handles create/read/update/delete + reset.
 */
export class EntityStore<T extends Entity> {
  private items: Map<string, T> = new Map();
  private initialState: Map<string, T> = new Map();
  private readonly defaultType?: string;

  constructor(initial: T[] = [], defaultType?: string) {
    this.defaultType = defaultType;
    this.loadItems(initial);
  }

  private loadItems(data: T[]): void {
    data.forEach((item) => {
      const id = (item.id as string | undefined) || randomUUID();
      const full = { ...item, id } as T;
      this.items.set(id, full);
      this.initialState.set(id, JSON.parse(JSON.stringify(full)) as T);
    });
  }

  getAll(): T[] {
    return Array.from(this.items.values());
  }

  getById(id: string): T | undefined {
    return this.items.get(id);
  }

  create(data: Partial<T>): T {
    const id = (data.guid as string | undefined) || randomUUID();
    const guid = id;
    const item = {
      id,
      guid,
      ...(this.defaultType ? { type: this.defaultType } : {}),
      ...data,
    } as T;
    this.items.set(id, item);
    return item;
  }

  update(id: string, data: Partial<T>): T | undefined {
    const existing = this.items.get(id);
    if (!existing) { return undefined; }
    const updated = { ...existing, ...data, id, guid: existing.guid } as T;
    this.items.set(id, updated);
    return updated;
  }

  patch(id: string, data: Partial<T>): T | undefined {
    return this.update(id, data);
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  exists(id: string): boolean {
    return this.items.has(id);
  }

  reset(): void {
    this.items.clear();
    this.initialState.forEach((item, id) => {
      this.items.set(id, JSON.parse(JSON.stringify(item)) as T);
    });
  }
}

export class StateManager {
  readonly windowsEndpoints: EntityStore<WindowsEndpoint>;
  readonly androidEndpoints: EntityStore<Entity>;
  readonly linuxEndpoints: EntityStore<Entity>;
  readonly macEndpoints: EntityStore<Entity>;
  readonly iosEndpoints: EntityStore<Entity>;
  readonly networkEndpoints: EntityStore<Entity>;
  readonly industrialEndpoints: EntityStore<Entity>;
  readonly logicalGroups: EntityStore<Entity>;
  readonly jobs: EntityStore<Entity>;
  readonly jobInstances: EntityStore<Entity>;
  readonly assets: EntityStore<Entity>;
  readonly variables: EntityStore<Entity>;

  constructor(fixtures: StateManagerFixtures | WindowsEndpoint[] = []) {
    // Support legacy array constructor (minimal-readwrite) and new fixtures object
    if (Array.isArray(fixtures)) {
      this.windowsEndpoints = new EntityStore<WindowsEndpoint>(fixtures, 'WindowsEndpoint');
      this.androidEndpoints = new EntityStore<Entity>([], 'AndroidEndpoint');
      this.linuxEndpoints = new EntityStore<Entity>([], 'LinuxEndpoint');
      this.macEndpoints = new EntityStore<Entity>([], 'MacEndpoint');
      this.iosEndpoints = new EntityStore<Entity>([], 'IOSEndpoint');
      this.networkEndpoints = new EntityStore<Entity>([], 'NetworkEndpoint');
      this.industrialEndpoints = new EntityStore<Entity>([], 'IndustrialEndpoint');
      this.logicalGroups = new EntityStore<Entity>([], 'LogicalGroup');
      this.jobs = new EntityStore<Entity>([], 'JobDefinition');
      this.jobInstances = new EntityStore<Entity>([], 'JobInstance');
      this.assets = new EntityStore<Entity>([], 'Asset');
      this.variables = new EntityStore<Entity>([], 'Variable');
    } else {
      this.windowsEndpoints = new EntityStore<WindowsEndpoint>(fixtures.windowsEndpoints ?? [], 'WindowsEndpoint');
      this.androidEndpoints = new EntityStore<Entity>(fixtures.androidEndpoints ?? [], 'AndroidEndpoint');
      this.linuxEndpoints = new EntityStore<Entity>(fixtures.linuxEndpoints ?? [], 'LinuxEndpoint');
      this.macEndpoints = new EntityStore<Entity>(fixtures.macEndpoints ?? [], 'MacEndpoint');
      this.iosEndpoints = new EntityStore<Entity>(fixtures.iosEndpoints ?? [], 'IOSEndpoint');
      this.networkEndpoints = new EntityStore<Entity>(fixtures.networkEndpoints ?? [], 'NetworkEndpoint');
      this.industrialEndpoints = new EntityStore<Entity>(fixtures.industrialEndpoints ?? [], 'IndustrialEndpoint');
      this.logicalGroups = new EntityStore<Entity>(fixtures.logicalGroups ?? [], 'LogicalGroup');
      this.jobs = new EntityStore<Entity>(fixtures.jobs ?? [], 'JobDefinition');
      this.jobInstances = new EntityStore<Entity>(fixtures.jobInstances ?? [], 'JobInstance');
      this.assets = new EntityStore<Entity>(fixtures.assets ?? [], 'Asset');
      this.variables = new EntityStore<Entity>(fixtures.variables ?? [], 'Variable');
    }
  }

  // --- Legacy API for backwards compatibility (WindowsEndpoints only) ---

  getAll(): WindowsEndpoint[] {
    return this.windowsEndpoints.getAll();
  }

  getById(id: string): WindowsEndpoint | undefined {
    return this.windowsEndpoints.getById(id);
  }

  create(data: Partial<WindowsEndpoint>): WindowsEndpoint {
    return this.windowsEndpoints.create(data);
  }

  update(id: string, data: Partial<WindowsEndpoint>): WindowsEndpoint | undefined {
    return this.windowsEndpoints.update(id, data);
  }

  patch(id: string, data: Partial<WindowsEndpoint>): WindowsEndpoint | undefined {
    return this.windowsEndpoints.patch(id, data);
  }

  delete(id: string): boolean {
    return this.windowsEndpoints.delete(id);
  }

  exists(id: string): boolean {
    return this.windowsEndpoints.exists(id);
  }

  /**
   * P13.0.10 — Dynamic store registry.
   * Allows new entity types to be added without modifying the constructor.
   */
  private readonly dynamicStores: Map<string, EntityStore<Entity>> = new Map();

  /**
   * Add a named dynamic store for a new entity type.
   * If the store already exists it is left unchanged (idempotent).
   *
   * @param key - Store key, e.g. 'variableDefinitions'
   * @param items - Initial items to populate the store with
   * @param defaultType - Optional type discriminator
   */
  addStore(key: string, items: Entity[] = [], defaultType?: string): EntityStore<Entity> {
    if (!this.dynamicStores.has(key)) {
      this.dynamicStores.set(key, new EntityStore<Entity>(items, defaultType));
    }
    // get() is guaranteed non-undefined: we set it just above if it was absent
    const store = this.dynamicStores.get(key);
    if (!store) { throw new Error(`Store '${key}' unexpectedly missing after set`); }
    return store;
  }

  /**
   * Retrieve a store by key — checks named stores first, then dynamic stores.
   * Returns undefined if not found in either location.
   */
  getStore(key: string): EntityStore<Entity> | undefined {
    // Named stores (initialized from fixtures in constructor)
    const named: Record<string, EntityStore<Entity>> = {
      windowsEndpoints: this.windowsEndpoints,
      androidEndpoints: this.androidEndpoints,
      linuxEndpoints: this.linuxEndpoints,
      macEndpoints: this.macEndpoints,
      iosEndpoints: this.iosEndpoints,
      networkEndpoints: this.networkEndpoints,
      industrialEndpoints: this.industrialEndpoints,
      logicalGroups: this.logicalGroups,
      jobs: this.jobs,
      jobInstances: this.jobInstances,
      assets: this.assets,
      variables: this.variables,
    };
    return named[key] ?? this.dynamicStores.get(key);
  }

  /**
   * Reset ALL entity stores to initial fixtures (for POST /api/reset)
   */
  reset(): void {
    this.windowsEndpoints.reset();
    this.androidEndpoints.reset();
    this.linuxEndpoints.reset();
    this.macEndpoints.reset();
    this.iosEndpoints.reset();
    this.networkEndpoints.reset();
    this.industrialEndpoints.reset();
    this.logicalGroups.reset();
    this.jobs.reset();
    this.jobInstances.reset();
    this.assets.reset();
    this.variables.reset();
    this.dynamicStores.forEach((store) => store.reset());
  }
}
