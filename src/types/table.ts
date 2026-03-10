export type TableContract = {
  version: number;
  tableId: string;
  title?: string;
  caption?: string | null;
  sourceType: "inline" | "dataset";
  columns: TableColumn[];
  rows?: TableRow[];
  dataset?: DatasetConfig | null;
  display: DisplayConfig;
  metadata?: Record<string, unknown>;
};

export type TableColumn = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "link" | "boolean" | "badge" | "image";
  sortable: boolean;
  searchable: boolean;
  pinnable: boolean;
  pinned: boolean;
  align: "left" | "center" | "right";
  mobilePriority: number;
  visible: boolean;
  formatter?: string | null;
  width?: number | null;
  minWidth?: number | null;
};

export type TableRow = {
  id: string;
  [key: string]: string | number | boolean | null;
};

export type DatasetConfig = {
  datasetKey: string;
  defaultSort?: {
    sortBy: string;
    sortDirection: "asc" | "desc";
  };
  defaultFilters?: unknown[];
  searchPlaceholder?: string;
  columnsSource?: "dataset" | "cms";
  allowCmsColumnOverrides?: boolean;
};

export type DisplayConfig = {
  variant: "condensed" | "full";
  pageSize: number;
  searchEnabled: boolean;
  sortingEnabled: boolean;
  paginationEnabled: boolean;
  stickyHeader: boolean;
  horizontalScroll: boolean;
  mobilePinnedColumns: string[];
  emptyStateMessage: string;
};

export type DatasetResponse = {
  columns: TableColumn[];
  rows: TableRow[];
  totalRowCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type DatasetQuery = {
  datasetKey: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  search?: string;
};
