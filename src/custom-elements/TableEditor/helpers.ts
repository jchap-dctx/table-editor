import type {
  InlineCellValue,
  InlineColumnType,
  InlineTableColumn,
  InlineTablePayloadV1,
  InlineTableRow,
  PayloadValidationResult,
  ScaleEstimate,
  ScaleThresholds,
} from "./types";

const DEFAULT_TABLE_ID = "inline-table";

export const DEFAULT_SCALE_THRESHOLDS: ScaleThresholds = {
  maxRows: 150,
  maxColumns: 20,
  maxPayloadBytes: 120_000,
};

export function createDefaultColumn(label: string, key: string, type: InlineColumnType = "text"): InlineTableColumn {
  return {
    key,
    label,
    type,
    sortable: true,
    searchable: false,
    pinnable: true,
    pinned: false,
    align: type === "number" ? "right" : "left",
    mobilePriority: 1,
    visible: true,
    formatter: null,
    width: null,
    minWidth: 80,
  };
}

export function createEmptyPayload(): InlineTablePayloadV1 {
  return {
    version: 1,
    tableId: DEFAULT_TABLE_ID,
    sourceType: "inline",
    columns: [],
    rows: [],
    metadata: {
      createdIn: "table-editor",
    },
  };
}

export function getTableEditorDraftStorageKey(itemId: string, variantCodename: string): string {
  return `table-editor-draft:${itemId}:${variantCodename}`;
}

export function normalizeHeaderToKey(header: string): string {
  const normalized = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "column";
}

function ensureUniqueKey(base: string, usedKeys: Set<string>): string {
  const normalized = normalizeHeaderToKey(base);
  if (!usedKeys.has(normalized)) {
    return normalized;
  }

  let suffix = 2;
  while (usedKeys.has(`${normalized}_${suffix}`)) {
    suffix += 1;
  }

  return `${normalized}_${suffix}`;
}

function inferColumnType(values: string[]): InlineColumnType {
  const nonEmpty = values.map((value) => value.trim()).filter(Boolean);
  if (nonEmpty.length === 0) {
    return "text";
  }

  const isBoolean = nonEmpty.every((value) => ["true", "false", "yes", "no", "1", "0"].includes(value.toLowerCase()));
  if (isBoolean) {
    return "boolean";
  }

  const isNumber = nonEmpty.every((value) => !Number.isNaN(Number(value)));
  if (isNumber) {
    return "number";
  }

  const isDate = nonEmpty.every((value) => !Number.isNaN(Date.parse(value)));
  if (isDate) {
    return "date";
  }

  const isLink = nonEmpty.every((value) => /^https?:\/\//i.test(value));
  if (isLink) {
    return "link";
  }

  return "text";
}

function normalizeCellValue(raw: string, type: InlineColumnType): InlineCellValue {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  if (type === "number") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }

  if (type === "boolean") {
    const normalized = value.toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "0"].includes(normalized)) {
      return false;
    }
  }

  return value;
}

function sanitizeColumn(raw: unknown, usedKeys: Set<string>, index: number): InlineTableColumn {
  const maybe = raw as Partial<InlineTableColumn>;
  const label = typeof maybe.label === "string" && maybe.label.trim() ? maybe.label.trim() : `Column ${index + 1}`;
  const keySource = typeof maybe.key === "string" && maybe.key.trim() ? maybe.key : label;
  const key = ensureUniqueKey(keySource, usedKeys);
  usedKeys.add(key);

  const type: InlineColumnType = ["text", "number", "date", "link", "boolean"].includes(String(maybe.type))
    ? (maybe.type as InlineColumnType)
    : "text";

  return {
    key,
    label,
    type,
    sortable: maybe.sortable ?? true,
    searchable: maybe.searchable ?? (type === "text" || type === "link"),
    pinnable: maybe.pinnable ?? true,
    pinned: maybe.pinned ?? false,
    align:
      maybe.align === "center" || maybe.align === "right" || maybe.align === "left"
        ? maybe.align
        : type === "number"
          ? "right"
          : "left",
    mobilePriority: Number.isFinite(Number(maybe.mobilePriority)) ? Number(maybe.mobilePriority) : 1,
    visible: maybe.visible ?? true,
    formatter: typeof maybe.formatter === "string" ? maybe.formatter : null,
    width: Number.isFinite(Number(maybe.width)) ? Number(maybe.width) : null,
    minWidth: Number.isFinite(Number(maybe.minWidth)) ? Number(maybe.minWidth) : 80,
  };
}

function sanitizeRows(columns: InlineTableColumn[], rows: unknown): InlineTableRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row, index) => {
    const maybe = (row ?? {}) as Record<string, unknown>;
    const next: InlineTableRow = {
      id: typeof maybe.id === "string" && maybe.id.trim() ? maybe.id : `row-${index + 1}`,
    };

    for (const column of columns) {
      const raw = maybe[column.key];
      if (raw === undefined || raw === null || raw === "") {
        next[column.key] = null;
        continue;
      }

      if (column.type === "number") {
        const numeric = Number(raw);
        next[column.key] = Number.isNaN(numeric) ? String(raw) : numeric;
        continue;
      }

      if (column.type === "boolean") {
        if (typeof raw === "boolean") {
          next[column.key] = raw;
          continue;
        }
        const normalized = String(raw).toLowerCase();
        if (["true", "yes", "1"].includes(normalized)) {
          next[column.key] = true;
          continue;
        }
        if (["false", "no", "0"].includes(normalized)) {
          next[column.key] = false;
          continue;
        }
      }

      next[column.key] = String(raw);
    }

    return next;
  });
}

export function parseStoredPayload(storedValue: unknown): { payload: InlineTablePayloadV1; warnings: string[] } {
  const warnings: string[] = [];
  if (storedValue === null || storedValue === undefined || storedValue === "") {
    return { payload: createEmptyPayload(), warnings };
  }

  let parsed: unknown = storedValue;
  if (typeof storedValue === "string") {
    try {
      parsed = JSON.parse(storedValue);
    } catch {
      warnings.push("Stored value is not valid JSON. Starting from an empty table.");
      return { payload: createEmptyPayload(), warnings };
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    warnings.push("Stored value has an unsupported shape. Starting from an empty table.");
    return { payload: createEmptyPayload(), warnings };
  }

  const maybe = parsed as Partial<InlineTablePayloadV1>;
  const usedKeys = new Set<string>();
  const columns = Array.isArray(maybe.columns)
    ? maybe.columns.map((column, index) => sanitizeColumn(column, usedKeys, index))
    : [];

  const payload: InlineTablePayloadV1 = {
    version: 1,
    tableId: typeof maybe.tableId === "string" && maybe.tableId.trim() ? normalizeHeaderToKey(maybe.tableId) : DEFAULT_TABLE_ID,
    sourceType: "inline",
    columns,
    rows: sanitizeRows(columns, maybe.rows),
    metadata: {
      createdIn: "table-editor",
      ...(typeof maybe.metadata === "object" && maybe.metadata ? maybe.metadata : {}),
    },
  };

  if (!Array.isArray(maybe.columns)) {
    warnings.push("Stored payload had no columns array. Created an empty table.");
  }

  return { payload, warnings };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === "\"") {
      const next = line[i + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseDelimitedText(text: string, delimiter: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "");

  if (delimiter === "\t") {
    return lines.map((line) => line.split("\t").map((cell) => cell.trim()));
  }

  return lines.map((line) => splitCsvLine(line).map((cell) => cell.trim()));
}

export function parseTabularText(text: string): string[][] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const tsv = parseDelimitedText(trimmed, "\t");
  if (tsv.length > 0 && tsv.some((row) => row.length > 1)) {
    return tsv;
  }

  return parseDelimitedText(trimmed, ",");
}

export function inferColumnsFromTabularData(
  matrix: string[][],
  firstRowIsHeader: boolean,
): { columns: InlineTableColumn[]; rows: InlineTableRow[] } {
  if (matrix.length === 0) {
    return { columns: [], rows: [] };
  }

  const normalizedMatrix = matrix.filter((row) => row.some((cell) => String(cell).trim() !== ""));
  if (normalizedMatrix.length === 0) {
    return { columns: [], rows: [] };
  }

  const width = normalizedMatrix.reduce((max, row) => Math.max(max, row.length), 0);
  const usedKeys = new Set<string>();
  const headerRow = firstRowIsHeader ? normalizedMatrix[0] : [];

  const columns = Array.from({ length: width }, (_, index) => {
    const header = firstRowIsHeader ? headerRow[index] || `Column ${index + 1}` : `Column ${index + 1}`;
    const dataRows = (firstRowIsHeader ? normalizedMatrix.slice(1) : normalizedMatrix).map((row) => row[index] || "");
    const type = inferColumnType(dataRows);
    const key = ensureUniqueKey(header, usedKeys);
    usedKeys.add(key);

    return createDefaultColumn(header, key, type);
  });

  const rowsSource = firstRowIsHeader ? normalizedMatrix.slice(1) : normalizedMatrix;
  const rows = rowsSource.map((rawRow, rowIndex) => {
    const row: InlineTableRow = { id: `row-${Date.now()}-${rowIndex}` };
    columns.forEach((column, columnIndex) => {
      row[column.key] = normalizeCellValue(rawRow[columnIndex] ?? "", column.type);
    });
    return row;
  });

  return { columns, rows };
}

export function buildPayloadFromGrid(input: {
  tableId: string;
  columns: InlineTableColumn[];
  rows: InlineTableRow[];
  metadata?: Record<string, unknown>;
}): InlineTablePayloadV1 {
  const usedKeys = new Set<string>();
  const normalizedColumns = input.columns.map((column, index) => {
    const sanitized = sanitizeColumn(column, usedKeys, index);
    return {
      ...sanitized,
      pinned: index === 0,
    };
  });

  const normalizedRows = input.rows.map((row, index) => {
    const next: InlineTableRow = {
      id: row.id || `row-${index + 1}`,
    };

    for (const column of normalizedColumns) {
      const raw = row[column.key];
      if (raw === undefined || raw === "") {
        next[column.key] = null;
        continue;
      }

      if (column.type === "number") {
        const parsed = Number(raw);
        next[column.key] = Number.isNaN(parsed) ? String(raw) : parsed;
        continue;
      }

      next[column.key] = raw as InlineCellValue;
    }

    return next;
  });

  return {
    version: 1,
    tableId: normalizeHeaderToKey(input.tableId || DEFAULT_TABLE_ID),
    sourceType: "inline",
    columns: normalizedColumns,
    rows: normalizedRows,
    metadata: {
      createdIn: "table-editor",
      ...(input.metadata ?? {}),
    },
  };
}

export function validatePayload(
  payload: InlineTablePayloadV1,
  context?: { importErrors?: string[] },
): PayloadValidationResult {
  const generalErrors: string[] = [];
  const columnErrors: Record<string, string[]> = {};
  const rowErrors: Record<string, string[]> = {};

  if (payload.columns.length === 0) {
    generalErrors.push("At least one column is required.");
  }

  const keySet = new Set<string>();
  payload.columns.forEach((column, index) => {
    const errors: string[] = [];
    if (!column.label.trim()) {
      errors.push("Column label is required.");
    }
    if (!column.key.trim()) {
      errors.push("Column key is required.");
    }

    if (column.key && keySet.has(column.key)) {
      errors.push("Column key must be unique.");
    }
    keySet.add(column.key);

    if (column.mobilePriority < 1) {
      errors.push("Mobile priority must be at least 1.");
    }

    if (errors.length > 0) {
      columnErrors[`column-${index}`] = errors;
    }
  });

  payload.rows.forEach((row, rowIndex) => {
    const errors: string[] = [];
    if (!row.id || !row.id.trim()) {
      errors.push("Row id is required.");
    }

    const rowKeys = new Set(Object.keys(row).filter((key) => key !== "id"));
    for (const column of payload.columns) {
      if (!rowKeys.has(column.key)) {
        errors.push(`Missing value for column key \"${column.key}\".`);
      }
      const value = row[column.key];
      if (column.type === "number" && value !== null && value !== "" && Number.isNaN(Number(value))) {
        errors.push(`Column \"${column.label}\" requires numeric values.`);
      }
    }

    for (const key of rowKeys) {
      if (!payload.columns.some((column) => column.key === key)) {
        errors.push(`Unknown row key \"${key}\".`);
      }
    }

    if (errors.length > 0) {
      rowErrors[row.id || `row-${rowIndex + 1}`] = errors;
    }
  });

  if (context?.importErrors && context.importErrors.length > 0) {
    generalErrors.push(...context.importErrors);
  }

  return {
    isValid: generalErrors.length === 0 && Object.keys(columnErrors).length === 0 && Object.keys(rowErrors).length === 0,
    generalErrors,
    columnErrors,
    rowErrors,
  };
}

export function estimatePayloadScale(
  payload: InlineTablePayloadV1,
  thresholds: ScaleThresholds = DEFAULT_SCALE_THRESHOLDS,
): ScaleEstimate {
  const rowCount = payload.rows.length;
  const columnCount = payload.columns.length;
  const payloadBytes = new Blob([JSON.stringify(payload)]).size;

  const messages: string[] = [];
  if (rowCount > thresholds.maxRows) {
    messages.push(`Row count ${rowCount} exceeds inline limit of ${thresholds.maxRows}.`);
  }
  if (columnCount > thresholds.maxColumns) {
    messages.push(`Column count ${columnCount} exceeds inline limit of ${thresholds.maxColumns}.`);
  }
  if (payloadBytes > thresholds.maxPayloadBytes) {
    messages.push(`Payload size ${payloadBytes} bytes exceeds inline limit of ${thresholds.maxPayloadBytes} bytes.`);
  }

  return {
    rowCount,
    columnCount,
    payloadBytes,
    exceedsInlineLimit: messages.length > 0,
    messages,
  };
}
