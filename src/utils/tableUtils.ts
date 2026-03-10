import Papa from "papaparse";
import type { DisplayConfig, TableColumn, TableContract, TableRow } from "../types/table";

const DEFAULT_DISPLAY: DisplayConfig = {
  variant: "full",
  pageSize: 10,
  searchEnabled: true,
  sortingEnabled: true,
  paginationEnabled: true,
  stickyHeader: true,
  horizontalScroll: true,
  mobilePinnedColumns: ["rank", "school"],
  emptyStateMessage: "No data available for this table.",
};

export function getDefaultDisplayConfig(): DisplayConfig {
  return { ...DEFAULT_DISPLAY, mobilePinnedColumns: [...DEFAULT_DISPLAY.mobilePinnedColumns] };
}

export function createColumn(label: string, key: string, type: TableColumn["type"] = "text"): TableColumn {
  return {
    key,
    label,
    type,
    sortable: true,
    searchable: true,
    pinnable: true,
    pinned: false,
    align: type === "number" ? "right" : "left",
    mobilePriority: 1,
    visible: true,
    formatter: null,
    width: null,
    minWidth: null,
  };
}

export function buildDefaultInlineContract(): TableContract {
  return {
    version: 1,
    tableId: "inline-rankings-demo",
    title: "Inline Table Prototype",
    caption: "Editors can build a table directly in the CMS-style UI.",
    sourceType: "inline",
    columns: [
      { ...createColumn("Rank", "rank", "number"), pinned: true, mobilePriority: 1 },
      { ...createColumn("School", "school"), pinned: true, mobilePriority: 1 },
      { ...createColumn("Record", "record"), mobilePriority: 2 },
      { ...createColumn("Points", "points", "number"), align: "right", mobilePriority: 3 },
    ],
    rows: [
      { id: "1", rank: 1, school: "North City", record: "24-2", points: 97 },
      { id: "2", rank: 2, school: "Lakeview Prep", record: "23-3", points: 92 },
      { id: "3", rank: 3, school: "Metro Academy", record: "22-4", points: 86 },
    ],
    dataset: null,
    display: getDefaultDisplayConfig(),
    metadata: {
      prototype: true,
    },
  };
}

export function slugifyKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "column";
}

export function createUniqueKey(base: string, usedKeys: Set<string>): string {
  const normalizedBase = slugifyKey(base);
  if (!usedKeys.has(normalizedBase)) {
    return normalizedBase;
  }

  let suffix = 2;
  while (usedKeys.has(`${normalizedBase}_${suffix}`)) {
    suffix += 1;
  }

  return `${normalizedBase}_${suffix}`;
}

export function inferColumnType(values: Array<string | number | boolean | null>): TableColumn["type"] {
  const nonEmptyValues = values.filter((value) => value !== "" && value !== null);
  if (nonEmptyValues.length === 0) {
    return "text";
  }

  const numeric = nonEmptyValues.every((value) => !Number.isNaN(Number(value)));
  return numeric ? "number" : "text";
}

export function parseSpreadsheetText(text: string): { columns: TableColumn[]; rows: TableRow[] } {
  const result = Papa.parse<string[]>(text.trim(), {
    delimiter: "\t",
    skipEmptyLines: true,
  });

  const parsedRows = result.data.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (parsedRows.length === 0) {
    return { columns: [], rows: [] };
  }

  const headers = parsedRows[0];
  const usedKeys = new Set<string>();
  const columns = headers.map((header, index) => {
    const values = parsedRows.slice(1).map((row) => row[index] ?? "");
    const key = createUniqueKey(header || `column_${index + 1}`, usedKeys);
    usedKeys.add(key);
    const type = inferColumnType(values);
    return createColumn(header || `Column ${index + 1}`, key, type);
  });

  const rows = parsedRows.slice(1).map((row, rowIndex) => {
    const nextRow: TableRow = { id: `row-${Date.now()}-${rowIndex}` };
    columns.forEach((column, columnIndex) => {
      const rawValue = row[columnIndex] ?? "";
      nextRow[column.key] = column.type === "number" && rawValue !== "" ? Number(rawValue) : rawValue;
    });
    return nextRow;
  });

  return { columns, rows };
}

export type ValidationResult = {
  generalErrors: string[];
  columnErrors: Record<string, string[]>;
  cellErrors: Record<string, string[]>;
};

export function validateInlineTable(columns: TableColumn[], rows: TableRow[]): ValidationResult {
  const generalErrors: string[] = [];
  const columnErrors: Record<string, string[]> = {};
  const cellErrors: Record<string, string[]> = {};
  const seenKeys = new Set<string>();

  columns.forEach((column, index) => {
    const messages: string[] = [];
    if (!column.label.trim()) {
      messages.push("Column label is required.");
    }
    if (!column.key.trim()) {
      messages.push("Column key is required.");
    } else if (seenKeys.has(column.key)) {
      messages.push("Column key must be unique.");
    } else {
      seenKeys.add(column.key);
    }
    if (messages.length > 0) {
      columnErrors[`column-${index}`] = messages;
    }
  });

  rows.forEach((row) => {
    const messages: string[] = [];
    columns.forEach((column) => {
      if (!(column.key in row)) {
        messages.push(`Missing value for ${column.label}.`);
      }
      const value = row[column.key];
      if (
        column.type === "number" &&
        value !== null &&
        value !== "" &&
        value !== undefined &&
        Number.isNaN(Number(value))
      ) {
        messages.push(`${column.label} must be numeric.`);
      }
    });
    if (messages.length > 0) {
      cellErrors[row.id] = messages;
    }
  });

  if (columns.length === 0) {
    generalErrors.push("Add at least one column before saving.");
  }
  if (rows.length === 0) {
    generalErrors.push("Add at least one row before saving.");
  }

  return { generalErrors, columnErrors, cellErrors };
}

export function normalizeRows(columns: TableColumn[], rows: TableRow[]): TableRow[] {
  return rows.map((row, index) => {
    const nextRow: TableRow = { id: row.id || `row-${index + 1}` };
    columns.forEach((column) => {
      const value = row[column.key];
      if (column.type === "number") {
        nextRow[column.key] = value === "" || value === null || value === undefined ? null : Number(value);
      } else {
        nextRow[column.key] = value === undefined ? null : value;
      }
    });
    return nextRow;
  });
}

export function buildCanonicalInlineContract(contract: TableContract): TableContract {
  return {
    ...contract,
    columns: contract.columns.map((column) => ({
      ...column,
      key: slugifyKey(column.key),
      label: column.label.trim(),
    })),
    rows: normalizeRows(contract.columns, contract.rows ?? []),
  };
}
