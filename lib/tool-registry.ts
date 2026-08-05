import toolData from "../data/tools.json" with { type: "json" };

export const categories = [
  "全部工具",
  "数据安全",
  "基础工作",
  "文书制作",
  "专业法律分析",
] as const;

export const statuses = ["connected", "local-skill", "installable", "planned", "building"] as const;

export type Category = (typeof categories)[number];
export type ToolStatus = (typeof statuses)[number];

export type ToolRecord = {
  id: string;
  name: string;
  category: Exclude<Category, "全部工具">;
  status: ToolStatus;
  summary: string;
  version: string;
  repository: string | null;
  localUrl: string | null;
  inputs: string[];
  outputs: string[];
  steps: string[];
  notice: string;
};

const recordKeys = [
  "id",
  "name",
  "category",
  "summary",
  "status",
  "version",
  "repository",
  "localUrl",
  "inputs",
  "outputs",
  "steps",
  "notice",
] as const satisfies readonly (keyof ToolRecord)[];

const recordKeySet = new Set<string>(recordKeys);
const toolCategorySet = new Set<Exclude<Category, "全部工具">>([
  "数据安全",
  "基础工作",
  "文书制作",
  "专业法律分析",
]);
const toolStatusSet = new Set<ToolStatus>(statuses);

function invalid(message: string): never {
  throw new TypeError(`Invalid tool registry: ${message}`);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    invalid(`${label} must be a non-empty string`);
  }

  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(`${label} must be a non-empty array`);
  }

  return value.map((item, index) => requiredString(item, `${label}[${index}]`));
}

function parseUrl(value: string, label: string): URL {
  try {
    return new URL(value);
  } catch {
    invalid(`${label} must be a valid URL`);
  }
}

function repositoryUrl(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  const source = requiredString(value, label);
  const url = parseUrl(source, label);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password ||
    pathSegments.length < 2
  ) {
    invalid(`${label} must be an HTTPS github.com owner/repository URL without credentials`);
  }

  return source;
}

function localUrl(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  const source = requiredString(value, label);
  const url = parseUrl(source, label);
  const port = Number(url.port);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    invalid(`${label} must be an http://127.0.0.1 URL with a port from 1 to 65535 and no credentials`);
  }

  return source;
}

function normalizeTool(value: unknown, index: number, ids: Set<string>): ToolRecord {
  const label = `tools[${index}]`;
  const record = asRecord(value, label);
  const keys = Object.keys(record);

  if (keys.length !== recordKeys.length || keys.some((key) => !recordKeySet.has(key))) {
    invalid(`${label} contains unknown or missing keys`);
  }
  for (const key of recordKeys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      invalid(`${label}.${key} is required`);
    }
  }

  const id = requiredString(record.id, `${label}.id`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) {
    invalid(`${label}.id must be a unique lowercase-hyphen identifier`);
  }
  ids.add(id);

  const category = requiredString(record.category, `${label}.category`);
  if (!toolCategorySet.has(category as Exclude<Category, "全部工具">)) {
    invalid(`${label}.category is not supported`);
  }

  const status = requiredString(record.status, `${label}.status`);
  if (!toolStatusSet.has(status as ToolStatus)) {
    invalid(`${label}.status is not supported`);
  }

  return Object.freeze({
    id,
    name: requiredString(record.name, `${label}.name`),
    category: category as Exclude<Category, "全部工具">,
    summary: requiredString(record.summary, `${label}.summary`),
    status: status as ToolStatus,
    version: requiredString(record.version, `${label}.version`),
    repository: repositoryUrl(record.repository, `${label}.repository`),
    localUrl: localUrl(record.localUrl, `${label}.localUrl`),
    inputs: stringArray(record.inputs, `${label}.inputs`),
    outputs: stringArray(record.outputs, `${label}.outputs`),
    steps: stringArray(record.steps, `${label}.steps`),
    notice: requiredString(record.notice, `${label}.notice`),
  });
}

export function validateToolRecords(value: unknown): readonly ToolRecord[] {
  if (!Array.isArray(value)) {
    invalid("tools must be an array");
  }

  const ids = new Set<string>();
  return Object.freeze(value.map((tool, index) => normalizeTool(tool, index, ids)));
}

export const tools = validateToolRecords(toolData);

export function getTool(toolId: string): ToolRecord | undefined {
  return tools.find((tool) => tool.id === toolId);
}
