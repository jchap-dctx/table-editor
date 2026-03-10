import { getDatasetDefinition } from "../data/mockDatasets";
import type { DatasetQuery, DatasetResponse, TableRow } from "../types/table";

function sortRows(rows: TableRow[], sortBy?: string, sortDirection: "asc" | "desc" = "asc"): TableRow[] {
  if (!sortBy) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const leftValue = left[sortBy];
    const rightValue = right[sortBy];

    if (leftValue === rightValue) {
      return 0;
    }

    if (leftValue === null || leftValue === undefined) {
      return 1;
    }
    if (rightValue === null || rightValue === undefined) {
      return -1;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
    }

    return sortDirection === "asc"
      ? String(leftValue).localeCompare(String(rightValue))
      : String(rightValue).localeCompare(String(leftValue));
  });
}

function searchRows(rows: TableRow[], search = ""): TableRow[] {
  if (!search.trim()) {
    return rows;
  }

  const term = search.trim().toLowerCase();
  return rows.filter((row) =>
    Object.values(row).some((value) => value !== null && String(value).toLowerCase().includes(term)),
  );
}

export async function fetchDatasetPage(query: DatasetQuery): Promise<DatasetResponse> {
  const definition = getDatasetDefinition(query.datasetKey);
  if (!definition) {
    throw new Error(`Unknown dataset "${query.datasetKey}".`);
  }

  const filteredRows = searchRows(definition.rows, query.search);
  const sortedRows = sortRows(filteredRows, query.sortBy, query.sortDirection);
  const pageSize = query.pageSize;
  const totalRowCount = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRowCount / pageSize));
  const page = Math.min(query.page, totalPages);
  const startIndex = (page - 1) * pageSize;
  const rows = sortedRows.slice(startIndex, startIndex + pageSize);

  await new Promise((resolve) => {
    window.setTimeout(resolve, 350);
  });

  return {
    columns: definition.columns,
    rows,
    totalRowCount,
    totalPages,
    page,
    pageSize,
  };
}
