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

/** Reads an entity type's initial data, e.g. profile.getFixture */
export type FixtureLoader = (entityType: string) => unknown;

/** The named stores and the type each new item gets */
const NAMED_STORES = {
  windowsEndpoints: 'WindowsEndpoint',
  androidEndpoints: 'AndroidEndpoint',
  linuxEndpoints: 'LinuxEndpoint',
  macEndpoints: 'MacEndpoint',
  iosEndpoints: 'IOSEndpoint',
  networkEndpoints: 'NetworkEndpoint',
  industrialEndpoints: 'IndustrialEndpoint',
  logicalGroups: 'LogicalGroup',
  jobs: 'JobDefinition',
  jobInstances: 'JobInstance',
  assets: 'Asset',
  variables: 'Variable',
} as const;

type NamedStore = keyof typeof NAMED_STORES;

export class StateManager {
  /**
   * Every store is created on first use, from the profile's data for its entity type. So all
   * read-write profiles start with the same data as their read-only twin, and a large-scale
   * profile builds only the generated lists a request actually touches. (Before, only
   * standard-readwrite seeded its stores; minimal- and largescale-readwrite started with
   * Windows endpoints only, and every other list was empty.)
   */
  private readonly load: FixtureLoader;
  private readonly namedStores = new Map<NamedStore, EntityStore<Entity>>();

  constructor(source: FixtureLoader | StateManagerFixtures | WindowsEndpoint[] = []) {
    if (typeof source === 'function') {
      this.load = source;
    } else if (Array.isArray(source)) {
      // Legacy: Windows endpoints only
      this.load = (key) => (key === 'windowsEndpoints' ? source : []);
    } else {
      this.load = (key) => source[key as keyof StateManagerFixtures] ?? [];
    }
  }

  private named(key: NamedStore): EntityStore<Entity> {
    let store = this.namedStores.get(key);
    if (!store) {
      const data = this.load(key);
      store = new EntityStore<Entity>(Array.isArray(data) ? (data as Entity[]) : [], NAMED_STORES[key]);
      this.namedStores.set(key, store);
    }
    return store;
  }

  get windowsEndpoints(): EntityStore<WindowsEndpoint> { return this.named('windowsEndpoints') as EntityStore<WindowsEndpoint>; }
  get androidEndpoints(): EntityStore<Entity> { return this.named('androidEndpoints'); }
  get linuxEndpoints(): EntityStore<Entity> { return this.named('linuxEndpoints'); }
  get macEndpoints(): EntityStore<Entity> { return this.named('macEndpoints'); }
  get iosEndpoints(): EntityStore<Entity> { return this.named('iosEndpoints'); }
  get networkEndpoints(): EntityStore<Entity> { return this.named('networkEndpoints'); }
  get industrialEndpoints(): EntityStore<Entity> { return this.named('industrialEndpoints'); }
  get logicalGroups(): EntityStore<Entity> { return this.named('logicalGroups'); }
  get jobs(): EntityStore<Entity> { return this.named('jobs'); }
  get jobInstances(): EntityStore<Entity> { return this.named('jobInstances'); }
  get assets(): EntityStore<Entity> { return this.named('assets'); }
  get variables(): EntityStore<Entity> { return this.named('variables'); }

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
    if (key in NAMED_STORES) { return this.named(key as NamedStore); }
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
    if (key in NAMED_STORES) { return this.named(key as NamedStore); }
    return this.dynamicStores.get(key);
  }

  /**
   * Reset ALL entity stores to initial fixtures (for POST /api/reset)
   */
  reset(): void {
    this.namedStores.forEach((store) => store.reset());
    this.dynamicStores.forEach((store) => store.reset());
  }
}
