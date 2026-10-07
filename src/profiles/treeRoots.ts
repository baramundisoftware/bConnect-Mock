/**
 * Hidden tree roots — how a live bMS names the parent of the top items of its trees
 *
 * A read-only probe of a live 26R1 bMS (26.1.161.0, 2026-10-07) found that no item of a tree
 * (logical groups, org units, folders) has parentId null: the top item of each tree points to a
 * hidden root node of its module, and `parent` holds that node's name in square brackets. Every
 * item carries `parent`, the name of its parent. The hidden node itself can't be fetched: by ID
 * and its children route answer 404 "not found or not visible".
 *
 * The bConnect specs agree: parentId is a non-nullable GUID, and LogicalGroup requires parent.
 * The mock's data has parentId null for top items and no `parent`; withHiddenTreeRoot() fills
 * both in, for every source (fixtures, generators) and for created or moved items.
 */

export interface HiddenRoot { id: string; name: string }

const ENVIRONMENT: HiddenRoot = { id: '299d0b30-d384-430c-875a-63c3ef73a150', name: '[environment]' };
const INVENTORY_ASSETS: HiddenRoot = { id: 'dc3233ba-487d-4ef9-969f-7cead5afd814', name: '[InventoryAssets]' };

/** The hidden root per tree, keyed by fixture/store name (values from the live bMS) */
export const HIDDEN_TREE_ROOTS: Readonly<Record<string, HiddenRoot>> = {
  logicalGroups: ENVIRONMENT,
  orgUnits: ENVIRONMENT,
  folders: ENVIRONMENT, // universal dynamic group folders
  jobFolders: { id: '8e5102e3-c2e1-47ba-ad76-295d3df9ef31', name: '[Jobs Module]' },
  osFolders: { id: '5f77955e-26a4-4a91-9b99-a4833a2e8cf6', name: '[Modul OS-Install]' },
  assetStockFolders: INVENTORY_ASSETS,
  assetTypeFolders: INVENTORY_ASSETS,
  bundleFolders: { id: 'e09ee6e7-3be1-44de-a28c-43e958378f72', name: '[Modul Deploy]' },
};

/** True for the ID of any hidden root: never served, by ID or as a parent */
export function isHiddenTreeRoot(id: string): boolean {
  const lower = id.toLowerCase();
  return Object.values(HIDDEN_TREE_ROOTS).some((root) => root.id === lower);
}

type Item = Record<string, unknown>;

const displayName = (item: Item | undefined): unknown => item?.['name'] ?? item?.['displayName'] ?? null;

/**
 * parentId and parent for an item of a tree: a missing, empty or null parentId becomes the
 * hidden root; parent is the name of the parent item (or the hidden root's name).
 */
export function treeParentFields(entityType: string, parentId: unknown, items: Item[]): { parentId: unknown; parent: unknown } | undefined {
  const root = HIDDEN_TREE_ROOTS[entityType];
  if (!root) { return undefined; }
  if (parentId === null || parentId === undefined || parentId === '' || parentId === root.id) {
    return { parentId: root.id, parent: root.name };
  }
  return { parentId, parent: displayName(items.find((i) => i['id'] === parentId)) };
}

/** The items of a tree with every parentId and parent filled in (other entity types unchanged) */
export function withHiddenTreeRoot(entityType: string, items: Item[]): Item[] {
  if (!HIDDEN_TREE_ROOTS[entityType]) { return items; }
  return items.map((item) => ({ ...item, ...treeParentFields(entityType, item['parentId'], items) }));
}
