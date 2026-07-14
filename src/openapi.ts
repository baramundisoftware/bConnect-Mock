/**
 * OpenAPI 3.0 specification for bConnect V2.0 Mock API
 * Served via Swagger UI at /api-docs
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'bConnect V2.0 Mock API',
    version: '2.0.0',
    description:
      'Mock server for bConnect V2.0 API — supports multiple profiles (minimal, standard, largescale) and BMS versions (25R2, 26R1).',
  },
  servers: [{ url: '/', description: 'Mock server' }],
  tags: [
    { name: 'Endpoints', description: 'Device endpoint resources' },
    { name: 'Software', description: 'Software inventory' },
    { name: 'Updates', description: 'Windows Update / CVE management' },
    { name: 'Jobs', description: 'Job definitions' },
    { name: 'Assets', description: 'Asset management' },
    { name: 'Variables', description: 'Custom variables' },
    { name: 'ActiveDirectory', description: 'AD groups and objects' },
    { name: 'ServerManagement', description: 'Microservices control' },
    { name: 'DefenseControl', description: 'BitLocker and OS folders' },
    { name: 'System', description: 'Health and administration' },
    { name: 'Compliance', description: 'Rules, vulnerabilities and violations (26R1+)' },
    { name: 'UniversalDynamicGroups', description: 'Universal dynamic groups and folders (26R1+)' },
  ],
  components: {
    parameters: {
      SearchQuery: {
        name: 'SearchQuery',
        in: 'query',
        schema: { type: 'string' },
        description: 'Filter by keyword across searchable fields',
      },
      OrderBy: {
        name: 'OrderBy',
        in: 'query',
        schema: { type: 'string' },
        description: 'Sort order, e.g. "displayName asc,lastSeen desc"',
      },
      Page: {
        name: 'Page',
        in: 'query',
        schema: { type: 'integer', default: 0 },
        description: 'Zero-based page index',
      },
      PageSize: {
        name: 'PageSize',
        in: 'query',
        schema: { type: 'integer' },
        description: 'Number of items per page (0 = all)',
      },
      IdPath: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    },
    schemas: {
      PaginatedResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: {} },
          pageSize: { type: 'integer' },
          page: { type: 'integer' },
          totalCount: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/reset': {
      post: {
        tags: ['System'],
        summary: 'Reset state to fixtures (readwrite profiles only)',
        responses: {
          '200': { description: 'State reset' },
          '404': { description: 'Not available in this profile' },
        },
      },
    },
    '/v2.0/Endpoints': {
      get: {
        tags: ['Endpoints'],
        summary: 'List all endpoints (all OS types combined)',
        description: 'Aggregates Windows, Android, Linux, Mac, iOS, Network and Industrial endpoints. Used by n8n baramundi node and bMCWeb.',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: {
          '200': { description: 'Paginated endpoint list (all types)', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } },
        },
      },
    },
    '/v2.0/WindowsEndpoints': {
      get: {
        tags: ['Endpoints'],
        summary: 'List Windows endpoints',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: {
          '200': { description: 'Paginated Windows endpoints', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } },
        },
      },
      post: {
        tags: ['Endpoints'],
        summary: 'Create Windows endpoint (readwrite profiles)',
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': { description: 'Created' },
          '403': { description: 'Read-only profile' },
        },
      },
    },
    '/v2.0/WindowsEndpoints/{id}': {
      get: {
        tags: ['Endpoints'],
        summary: 'Get Windows endpoint by ID',
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: {
          '200': { description: 'Windows endpoint' },
          '404': { description: 'Not found' },
        },
      },
      put: {
        tags: ['Endpoints'],
        summary: 'Replace Windows endpoint',
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } },
      },
      patch: {
        tags: ['Endpoints'],
        summary: 'Partially update Windows endpoint',
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } },
      },
      delete: {
        tags: ['Endpoints'],
        summary: 'Delete Windows endpoint',
        parameters: [{ $ref: '#/components/parameters/IdPath' }],
        responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } },
      },
    },
    '/v2.0/AndroidEndpoints': {
      get: {
        tags: ['Endpoints'],
        summary: 'List Android endpoints',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated Android endpoints', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Endpoints'], summary: 'Create Android endpoint', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' }, '403': { description: 'Read-only' } } },
    },
    '/v2.0/LinuxEndpoints': {
      get: {
        tags: ['Endpoints'],
        summary: 'List Linux endpoints',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated Linux endpoints', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Endpoints'], summary: 'Create Linux endpoint', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' }, '403': { description: 'Read-only' } } },
    },
    '/v2.0/LinuxEndpoints/{id}': {
      put: { tags: ['Endpoints'], summary: 'Replace Linux endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      patch: { tags: ['Endpoints'], summary: 'Partially update Linux endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Endpoints'], summary: 'Delete Linux endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' } } },
    },
    '/v2.0/MacEndpoints': {
      get: {
        tags: ['Endpoints'],
        summary: 'List Mac endpoints',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated Mac endpoints', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Endpoints'], summary: 'Create Mac endpoint', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' }, '403': { description: 'Read-only' } } },
    },
    '/v2.0/MacEndpoints/{id}': {
      put: { tags: ['Endpoints'], summary: 'Replace Mac endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      patch: { tags: ['Endpoints'], summary: 'Partially update Mac endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Endpoints'], summary: 'Delete Mac endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' } } },
    },
    '/v2.0/Software': {
      get: {
        tags: ['Software'],
        summary: 'List software',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated software list', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/WindowsUpdates': {
      get: {
        tags: ['Updates'],
        summary: 'List Windows updates (CVEs)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated updates', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/JobDefinitions': {
      get: {
        tags: ['Jobs'],
        summary: 'List job definitions',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated jobs', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Jobs'], summary: 'Create job definition', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/v2.0/JobDefinitions/{id}': {
      get: { tags: ['Jobs'], summary: 'Get job definition by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Job definition' }, '404': { description: 'Not found' } } },
      put: { tags: ['Jobs'], summary: 'Replace job definition', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      patch: { tags: ['Jobs'], summary: 'Partially update job definition', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Jobs'], summary: 'Delete job definition', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' } } },
    },
    '/v2.0/JobInstances': {
      get: {
        tags: ['Jobs'],
        summary: 'List job instances',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated job instances', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Jobs'], summary: 'Create (assign) job instance', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['jobDefinitionId', 'endpointId'], properties: { jobDefinitionId: { type: 'string' }, endpointId: { type: 'string' }, startIfAlreadyAssigned: { type: 'boolean' } } } } } }, responses: { '201': { description: 'Created' }, '403': { description: 'Read-only profile' } } },
    },
    '/v2.0/JobInstances/{id}': {
      get: { tags: ['Jobs'], summary: 'Get job instance by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Job instance' }, '404': { description: 'Not found' } } },
      delete: { tags: ['Jobs'], summary: 'Delete job instance', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/JobInstances/{id}/Start': {
      post: { tags: ['Jobs'], summary: 'Start job instance', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Started' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/JobInstances/{id}/Stop': {
      post: { tags: ['Jobs'], summary: 'Stop job instance', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Stopped' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/JobInstances/{id}/Resume': {
      post: { tags: ['Jobs'], summary: 'Resume job instance', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Resumed' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/Assets': {
      get: {
        tags: ['Assets'],
        summary: 'List assets',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated assets', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Assets'], summary: 'Create asset', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/v2.0/Assets/{id}': {
      put: { tags: ['Assets'], summary: 'Replace asset', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      patch: { tags: ['Assets'], summary: 'Partially update asset', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Assets'], summary: 'Delete asset', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' } } },
    },
    '/v2.0/Variables': {
      get: {
        tags: ['Variables'],
        summary: 'List variables',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated variables', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Variables'], summary: 'Create variable', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' } } },
    },
    '/v2.0/Variables/{id}': {
      put: { tags: ['Variables'], summary: 'Replace variable', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      patch: { tags: ['Variables'], summary: 'Partially update variable', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Variables'], summary: 'Delete variable', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' } } },
    },
    '/v2.0/ADGroups': {
      get: {
        tags: ['ActiveDirectory'],
        summary: 'List AD groups',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated AD groups', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/ADGroups/{id}': {
      get: { tags: ['ActiveDirectory'], summary: 'Get AD group by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'AD group' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/ADObjects': {
      get: {
        tags: ['ActiveDirectory'],
        summary: 'List AD objects',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated AD objects', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/ADObjects/{id}': {
      get: { tags: ['ActiveDirectory'], summary: 'Get AD object by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'AD object' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/Microservices': {
      get: {
        tags: ['ServerManagement'],
        summary: 'List microservices',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated microservices', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/Microservices/{id}': {
      get: { tags: ['ServerManagement'], summary: 'Get microservice by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Microservice' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/Microservices/{id}/Start': {
      post: { tags: ['ServerManagement'], summary: 'Start microservice', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Started' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/Microservices/{id}/Stop': {
      post: { tags: ['ServerManagement'], summary: 'Stop microservice', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Stopped' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/Microservices/{id}/Restart': {
      post: { tags: ['ServerManagement'], summary: 'Restart microservice', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Restarted' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/BitLocker/WindowsEndpoints': {
      get: {
        tags: ['DefenseControl'],
        summary: 'List BitLocker-protected Windows endpoints',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated BitLocker endpoints', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/BitLocker/WindowsEndpoints/{id}': {
      get: { tags: ['DefenseControl'], summary: 'Get BitLocker endpoint by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'BitLocker endpoint' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/OSFolders': {
      get: {
        tags: ['DefenseControl'],
        summary: 'List OS folders',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated OS folders', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/OSFolders/{id}': {
      get: { tags: ['DefenseControl'], summary: 'Get OS folder by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'OS folder' }, '404': { description: 'Not found' } } },
    },

    // --- AndroidEndpoints GET by ID (missing from original spec) ---
    '/v2.0/AndroidEndpoints/{id}': {
      get: { tags: ['Endpoints'], summary: 'Get Android endpoint by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Android endpoint' }, '404': { description: 'Not found' } } },
      put: { tags: ['Endpoints'], summary: 'Replace Android endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      patch: { tags: ['Endpoints'], summary: 'Partially update Android endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' } } },
      delete: { tags: ['Endpoints'], summary: 'Delete Android endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' } } },
    },

    // --- iOS Endpoints ---
    '/v2.0/IosEndpoints': {
      get: {
        tags: ['Endpoints'],
        summary: 'List iOS/iPadOS endpoints',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated iOS endpoints', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Endpoints'], summary: 'Create iOS endpoint (readwrite profiles)', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' }, '403': { description: 'Read-only profile' } } },
    },
    '/v2.0/IosEndpoints/{id}': {
      get: { tags: ['Endpoints'], summary: 'Get iOS endpoint by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'iOS endpoint' }, '404': { description: 'Not found' } } },
      patch: { tags: ['Endpoints'], summary: 'Partially update iOS endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } } },
      delete: { tags: ['Endpoints'], summary: 'Delete iOS endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } } },
    },

    // --- Network Endpoints ---
    '/v2.0/NetworkEndpoints': {
      get: {
        tags: ['Endpoints'],
        summary: 'List network endpoints',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated network endpoints', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Endpoints'], summary: 'Create network endpoint (readwrite profiles)', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' }, '403': { description: 'Read-only profile' } } },
    },
    '/v2.0/NetworkEndpoints/{id}': {
      get: { tags: ['Endpoints'], summary: 'Get network endpoint by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Network endpoint' }, '404': { description: 'Not found' } } },
      patch: { tags: ['Endpoints'], summary: 'Partially update network endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } } },
      delete: { tags: ['Endpoints'], summary: 'Delete network endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } } },
    },

    // --- Industrial Endpoints ---
    '/v2.0/IndustrialEndpoints': {
      get: {
        tags: ['Endpoints'],
        summary: 'List industrial/OT endpoints',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated industrial endpoints', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Endpoints'], summary: 'Create industrial endpoint (readwrite profiles)', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' }, '403': { description: 'Read-only profile' } } },
    },
    '/v2.0/IndustrialEndpoints/{id}': {
      get: { tags: ['Endpoints'], summary: 'Get industrial endpoint by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Industrial endpoint' }, '404': { description: 'Not found' } } },
      patch: { tags: ['Endpoints'], summary: 'Partially update industrial endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } } },
      delete: { tags: ['Endpoints'], summary: 'Delete industrial endpoint', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } } },
    },

    // --- Logical Groups ---
    '/v2.0/LogicalGroups': {
      get: {
        tags: ['Endpoints'],
        summary: 'List logical groups (hierarchical endpoint groupings)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated logical groups', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: { tags: ['Endpoints'], summary: 'Create logical group (readwrite profiles)', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '201': { description: 'Created' }, '403': { description: 'Read-only profile' } } },
    },
    '/v2.0/LogicalGroups/{id}': {
      get: { tags: ['Endpoints'], summary: 'Get logical group by ID', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Logical group' }, '404': { description: 'Not found' } } },
      patch: { tags: ['Endpoints'], summary: 'Partially update logical group', parameters: [{ $ref: '#/components/parameters/IdPath' }], requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } } },
      delete: { tags: ['Endpoints'], summary: 'Delete logical group', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } } },
    },

    // --- Unmanaged Endpoints (26R1 only) ---
    '/v2.0/UnmanagedEndpoints': {
      get: {
        tags: ['Endpoints'],
        summary: 'List unmanaged endpoints discovered on the network (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated unmanaged endpoints', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }, '404': { description: 'Not available in 25R2' } },
      },
    },
    '/v2.0/UnmanagedEndpoints/{id}': {
      get: { tags: ['Endpoints'], summary: 'Get unmanaged endpoint by ID (26R1+)', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Unmanaged endpoint' }, '404': { description: 'Not found or not available in 25R2' } } },
    },

    // --- Entra ID Data (26R1 only) ---
    '/v2.0/EntraIdData': {
      get: {
        tags: ['Endpoints'],
        summary: 'List Entra ID / Azure AD device data (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated Entra ID data', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } }, '404': { description: 'Not available in 25R2' } },
      },
    },
    '/v2.0/EntraIdData/{deviceId}': {
      get: { tags: ['Endpoints'], summary: 'Get Entra ID data for a device (26R1+)', parameters: [{ name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Entra ID device data' }, '404': { description: 'Not found or not available in 25R2' } } },
    },

    // --- Compliance (26R1+) ---
    '/v2.0/Rules': {
      get: {
        tags: ['Compliance'],
        summary: 'List compliance rules (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated compliance rules', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/Rules/{id}': {
      get: { tags: ['Compliance'], summary: 'Get compliance rule by ID (26R1+)', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Compliance rule' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/Vulnerabilities': {
      get: {
        tags: ['Compliance'],
        summary: 'List vulnerabilities (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated vulnerabilities', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/Vulnerabilities/{id}': {
      get: { tags: ['Compliance'], summary: 'Get vulnerability by ID (26R1+)', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Vulnerability' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/DetectedVulnerabilities': {
      get: {
        tags: ['Compliance'],
        summary: 'List detected vulnerabilities (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated detected vulnerabilities', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/DetectedRuleViolations': {
      get: {
        tags: ['Compliance'],
        summary: 'List detected rule violations (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated rule violations', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },

    // --- UniversalDynamicGroups (26R1+) ---
    '/v2.0/UniversalDynamicGroups': {
      get: {
        tags: ['UniversalDynamicGroups'],
        summary: 'List universal dynamic groups (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated universal dynamic groups', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/UniversalDynamicGroups/{id}': {
      get: { tags: ['UniversalDynamicGroups'], summary: 'Get universal dynamic group by ID (26R1+)', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Universal dynamic group' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/UniversalDynamicGroupsFolder': {
      get: {
        tags: ['UniversalDynamicGroups'],
        summary: 'List universal dynamic group folders (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated UDG folders', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/UniversalDynamicGroupsFolder/{id}': {
      get: { tags: ['UniversalDynamicGroups'], summary: 'Get universal dynamic group folder by ID (26R1+)', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'UDG folder' }, '404': { description: 'Not found' } } },
    },

    // --- Software: Bundles (26R1+) ---
    '/v2.0/Bundles': {
      get: {
        tags: ['Software'],
        summary: 'List software bundles (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/OrderBy' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated software bundles', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/Bundles/{id}': {
      get: { tags: ['Software'], summary: 'Get software bundle by ID (26R1+)', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Software bundle' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/BundleApplications': {
      get: {
        tags: ['Software'],
        summary: 'List bundle applications (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated bundle applications', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/BundleApplications/{id}': {
      get: { tags: ['Software'], summary: 'Get bundle application by ID (26R1+)', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Bundle application' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/Bundle/Folders': {
      get: {
        tags: ['Software'],
        summary: 'List bundle folders (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated bundle folders', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/Bundle/Folders/{id}': {
      get: { tags: ['Software'], summary: 'Get bundle folder by ID (26R1+)', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Bundle folder' }, '404': { description: 'Not found' } } },
    },

    // --- ServerManagement expansion (26R1+) ---
    '/v2.0/ApiKeys': {
      get: {
        tags: ['ServerManagement'],
        summary: 'List API keys (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated API keys', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/DownloadJobs': {
      get: {
        tags: ['ServerManagement'],
        summary: 'List download jobs (26R1+)',
        parameters: [
          { $ref: '#/components/parameters/SearchQuery' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/PageSize' },
        ],
        responses: { '200': { description: 'Paginated download jobs', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
    },
    '/v2.0/DownloadJobs/{id}': {
      get: { tags: ['ServerManagement'], summary: 'Get download job by ID (26R1+)', parameters: [{ $ref: '#/components/parameters/IdPath' }], responses: { '200': { description: 'Download job' }, '404': { description: 'Not found' } } },
    },
    '/v2.0/Dips/SimulateMSWCleanup': {
      post: { tags: ['ServerManagement'], summary: 'Simulate MSW cleanup (26R1+)', responses: { '200': { description: 'Simulation triggered' } } },
    },
    '/v2.0/Dips/MSWCleanup': {
      post: { tags: ['ServerManagement'], summary: 'Trigger MSW cleanup (26R1+)', responses: { '200': { description: 'Cleanup triggered' } } },
    },
  },
};
