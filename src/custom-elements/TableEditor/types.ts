export type InlineColumnType = "text" | "number" | "date" | "link" | "boolean";

export type InlineTableColumn = {
  key: string;
  label: string;
  type: InlineColumnType;
  sortable: boolean;
  searchable: boolean;
  pinnable: boolean;
  pinned: boolean;
  align: "left" | "center" | "right";
  mobilePriority: number;
  visible: boolean;
  formatter: string | null;
  width: number | null;
  minWidth: number | null;
};

export type InlineCellValue = string | number | boolean | null;

export type InlineTableRow = {
  id: string;
} & Record<string, InlineCellValue>;

export type InlineTableMetadata = {
  createdIn: "table-editor";
  [key: string]: unknown;
};

export type InlineTablePayloadV1 = {
  version: 1;
  tableId: string;
  sourceType: "inline";
  columns: InlineTableColumn[];
  rows: InlineTableRow[];
  metadata: InlineTableMetadata;
};

export type PayloadValidationResult = {
  isValid: boolean;
  generalErrors: string[];
  columnErrors: Record<string, string[]>;
  rowErrors: Record<string, string[]>;
};

export type ScaleThresholds = {
  maxRows: number;
  maxColumns: number;
  maxPayloadBytes: number;
};

export type ScaleEstimate = {
  rowCount: number;
  columnCount: number;
  payloadBytes: number;
  exceedsInlineLimit: boolean;
  messages: string[];
};
