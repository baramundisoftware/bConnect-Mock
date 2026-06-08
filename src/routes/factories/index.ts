/**
 * Route factory barrel — re-exports all route factories.
 */
export { registerReadonlyList } from './readonlyList';
export type { ReadonlyListConfig } from './readonlyList';

export { registerGetById } from './getById';
export type { GetByIdConfig } from './getById';

export { registerSubResourceList } from './subResourceList';
export type { SubResourceListConfig } from './subResourceList';

export { registerCrudRoutes } from './crudRoutes';
export type { CrudRoutesConfig } from './crudRoutes';

export { registerActionRoute } from './actionRoute';
export type { ActionRouteConfig } from './actionRoute';

export { registerSingleton } from './singleton';
export type { SingletonConfig } from './singleton';
