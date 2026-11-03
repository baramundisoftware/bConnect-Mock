/**
 * A small OpenAPI 3.0 schema validator for the bConnect specs.
 *
 * Covers exactly the keywords the specs use: $ref, allOf, discriminator (with a mapping), type,
 * nullable, enum, format, properties, required, additionalProperties, items, minLength,
 * maxLength. oneOf/anyOf are not checked. Every finding is
 * one stable line ("data[*].type: not in enum: \"X\""), so the findings can be kept in a
 * baseline file and compared run by run.
 */

export type Schema = Record<string, unknown>;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FORMATS: Record<string, (v: string) => boolean> = {
  guid: (v) => GUID.test(v),
  uuid: (v) => GUID.test(v),
  'date-time': (v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !isNaN(Date.parse(v)),
  date: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
};

const TYPES: Record<string, (v: unknown) => boolean> = {
  string: (v) => typeof v === 'string',
  integer: (v) => Number.isInteger(v),
  number: (v) => typeof v === 'number',
  boolean: (v) => typeof v === 'boolean',
  array: (v) => Array.isArray(v),
  object: (v) => typeof v === 'object' && v !== null && !Array.isArray(v),
};

export class SpecValidator {
  constructor(private readonly schemas: Record<string, Schema>) {}

  /** Follow a $ref and merge allOf parts into one schema */
  resolve(schema: Schema | undefined): Schema {
    if (!schema) { return {}; }
    if (typeof schema['$ref'] === 'string') {
      const name = (schema['$ref'] as string).split('/').pop() as string;
      const { $ref: _ref, ...rest } = schema;
      return { ...this.resolve(this.schemas[name]), ...rest };
    }
    if (Array.isArray(schema['allOf'])) {
      const { allOf, ...rest } = schema;
      const merged: Schema = {};
      for (const part of (allOf as Schema[]).map((p) => this.resolve(p))) {
        merged['properties'] = { ...(merged['properties'] as Schema | undefined), ...(part['properties'] as Schema | undefined) };
        merged['required'] = [...((merged['required'] as string[]) ?? []), ...((part['required'] as string[]) ?? [])];
        for (const [k, v] of Object.entries(part)) {
          if (k !== 'properties' && k !== 'required' && !(k in merged)) { merged[k] = v; }
        }
      }
      if (Object.keys(merged['properties'] as Schema).length === 0) { delete merged['properties']; }
      if ((merged['required'] as string[]).length === 0) { delete merged['required']; }
      return { ...merged, ...rest };
    }
    return schema;
  }

  /** All findings for a value, with array indexes normalized to [*] */
  validate(rawSchema: Schema | undefined, value: unknown, path = ''): string[] {
    let schema = this.resolve(rawSchema);
    const at = path || '(root)';
    const discriminator = schema['discriminator'] as { propertyName: string; mapping?: Record<string, string> } | undefined;
    if (discriminator?.mapping && TYPES['object']?.(value)) {
      // The subtype the value names (26R2: RepetitionDefinition → Daily/Weekly); a subtype is
      // allOf [base, own fields], so it carries the base's discriminator, which is dropped here
      const name = (value as Record<string, unknown>)[discriminator.propertyName];
      const ref = typeof name === 'string' ? discriminator.mapping[name] : undefined;
      if (!ref) { return [`${path ? `${path}.` : ''}${discriminator.propertyName}: not in discriminator mapping: ${JSON.stringify(name)}`]; }
      const { discriminator: _discriminator, ...subtype } = this.resolve({ $ref: ref });
      schema = subtype;
    }
    if (value === null || value === undefined) {
      return schema['nullable'] === true || schema['type'] === undefined ? [] : [`${at}: null, but not nullable`];
    }
    const findings: string[] = [];
    const enumValues = schema['enum'] as unknown[] | undefined;
    if (enumValues && !enumValues.includes(value)) {
      findings.push(`${at}: not in enum: ${JSON.stringify(value)}`);
      return findings;
    }
    const type = schema['type'] as string | undefined;
    if (type && TYPES[type] && !TYPES[type](value)) {
      return [`${at}: expected ${type}, got ${Array.isArray(value) ? 'array' : typeof value}`];
    }
    if (typeof value === 'string') {
      const format = schema['format'] as string | undefined;
      if (format && FORMATS[format] && !FORMATS[format](value)) { findings.push(`${at}: not a valid ${format}: ${JSON.stringify(value)}`); }
      if (typeof schema['maxLength'] === 'number' && value.length > (schema['maxLength'] as number)) { findings.push(`${at}: longer than ${schema['maxLength'] as number}`); }
      if (typeof schema['minLength'] === 'number' && value.length < (schema['minLength'] as number)) { findings.push(`${at}: shorter than ${schema['minLength'] as number}`); }
    }
    if (Array.isArray(value) && schema['items']) {
      const seen = new Set<string>();
      for (const item of value) {
        for (const f of this.validate(schema['items'] as Schema, item, `${path}[*]`)) { seen.add(f); }
      }
      findings.push(...seen);
    }
    if (TYPES['object']?.(value) && (schema['properties'] || schema['additionalProperties'] !== undefined || type === 'object')) {
      const obj = value as Record<string, unknown>;
      const properties = (schema['properties'] as Record<string, Schema> | undefined) ?? {};
      for (const name of (schema['required'] as string[] | undefined) ?? []) {
        if (!(name in obj)) { findings.push(`${path ? `${path}.` : ''}${name}: required, missing`); }
      }
      const additional = schema['additionalProperties'];
      for (const [name, v] of Object.entries(obj)) {
        const child = `${path ? `${path}.` : ''}${name}`;
        if (properties[name]) {
          findings.push(...this.validate(properties[name], v, child));
        } else if (additional && typeof additional === 'object') {
          findings.push(...this.validate(additional as Schema, v, child));
        } else if (Object.keys(properties).length > 0 || additional === false) {
          findings.push(`${child}: not in spec${additional === false ? ' (additionalProperties: false)' : ''}`);
        }
      }
    }
    return findings;
  }
}
