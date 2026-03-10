import {
  type ColumnPinningState,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { TableColumn, TableContract, TableRow } from "../types/table";

type DataTableProps = {
  contract: TableContract;
  rows?: TableRow[];
  loading?: boolean;
  error?: string | null;
  manualPagination?: boolean;
  totalRowCount?: number;
  totalPages?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  onSortingChange?: (sortBy?: string, sortDirection?: "asc" | "desc") => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
};

function renderCellValue(column: TableColumn, value: TableRow[string]) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (column.type === "number") {
    return typeof value === "number" ? value.toLocaleString() : Number(value).toLocaleString();
  }

  if (column.type === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function getColumnStyles(
  column: ReturnType<ReturnType<typeof useReactTable<TableRow>>["getAllLeafColumns"]>[number],
  stickyHeader: boolean,
  isHeader = false,
): CSSProperties {
  const isPinned = column.getIsPinned();
  const width = column.getSize();

  return {
    width,
    minWidth: width,
    ...(isPinned
      ? {
          left: isPinned === "left" ? `${column.getStart("left")}px` : undefined,
          right: isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
        }
      : {}),
    ...(isHeader && stickyHeader
      ? {
          top: 0,
        }
      : {}),
  };
}

export function DataTable({
  contract,
  rows,
  loading = false,
  error = null,
  manualPagination = false,
  totalRowCount,
  totalPages,
  page,
  onPageChange,
  onSortingChange,
  searchValue = "",
  onSearchChange,
}: DataTableProps) {
  const visibleColumns = contract.columns.filter((column) => column.visible);
  const initialRows = rows ?? contract.rows ?? [];
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (contract.dataset?.defaultSort) {
      return [
        {
          id: contract.dataset.defaultSort.sortBy,
          desc: contract.dataset.defaultSort.sortDirection === "desc",
        },
      ];
    }
    return [];
  });
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: Math.max((page ?? 1) - 1, 0),
    pageSize: contract.display.pageSize,
  });
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: visibleColumns.filter((column) => column.pinned).map((column) => column.key),
    right: [] as string[],
  });

  useEffect(() => {
    setPagination((current) => ({
      ...current,
      pageIndex: Math.max((page ?? 1) - 1, 0),
      pageSize: contract.display.pageSize,
    }));
  }, [contract.display.pageSize, page]);

  useEffect(() => {
    const pinnedColumns = visibleColumns
      .filter((column) => column.pinned || contract.display.mobilePinnedColumns.includes(column.key))
      .map((column) => column.key);
    setColumnPinning({ left: pinnedColumns, right: [] });
  }, [contract.display.mobilePinnedColumns, visibleColumns]);

  useEffect(() => {
    if (contract.dataset?.defaultSort) {
      setSorting([
        {
          id: contract.dataset.defaultSort.sortBy,
          desc: contract.dataset.defaultSort.sortDirection === "desc",
        },
      ]);
      return;
    }

    setSorting([]);
  }, [contract.tableId]);

  const columnDefs: ColumnDef<TableRow>[] = visibleColumns.map((column) => ({
    id: column.key,
    accessorKey: column.key,
    header: column.label,
    enableSorting: contract.display.sortingEnabled && column.sortable,
    enablePinning: column.pinnable,
    size: column.width ?? (column.type === "number" ? 120 : 180),
    minSize: column.minWidth ?? (column.type === "number" ? 96 : 140),
    cell: ({ row }) => renderCellValue(column, row.original[column.key]),
    meta: {
      align: column.align,
      type: column.type,
    },
  }));

  const table = useReactTable({
    data: initialRows,
    columns: columnDefs,
    state: {
      sorting,
      pagination,
      columnPinning,
    },
    onSortingChange: (updater) => {
      const nextSorting = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(nextSorting);
      const nextSort = nextSorting[0];
      onSortingChange?.(nextSort?.id, nextSort ? (nextSort.desc ? "desc" : "asc") : undefined);
    },
    onPaginationChange: (updater) => {
      const nextPagination = typeof updater === "function" ? updater(pagination) : updater;
      setPagination(nextPagination);
      if (manualPagination && onPageChange) {
        onPageChange(nextPagination.pageIndex + 1);
      }
    },
    onColumnPinningChange: (updater) => {
      const nextPinning = typeof updater === "function" ? updater(columnPinning) : updater;
      setColumnPinning({
        left: nextPinning.left ?? [],
        right: nextPinning.right ?? [],
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualPagination ? undefined : getSortedRowModel(),
    getPaginationRowModel: contract.display.paginationEnabled && !manualPagination ? getPaginationRowModel() : undefined,
    manualPagination,
    manualSorting: manualPagination,
    pageCount: manualPagination ? totalPages : undefined,
    rowCount: manualPagination ? totalRowCount : undefined,
  });

  const rowModel = contract.display.paginationEnabled ? table.getRowModel() : table.getPrePaginationRowModel();
  const pageCount = manualPagination ? totalPages ?? 1 : table.getPageCount();
  const currentPage = manualPagination ? page ?? 1 : table.getState().pagination.pageIndex + 1;

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Renderer</p>
          <h2>{contract.title || "Untitled table"}</h2>
          {contract.caption ? <p className="muted">{contract.caption}</p> : null}
        </div>
        <div className="chip-row">
          <span className="chip">{contract.sourceType}</span>
          <span className="chip">{contract.display.variant}</span>
          <span className="chip">{visibleColumns.length} columns</span>
        </div>
      </div>

      {contract.display.searchEnabled && onSearchChange ? (
        <label className="search-field">
          <span>Search</span>
          <input
            value={searchValue}
            onChange={(event) => {
              onSearchChange(event.target.value);
              if (manualPagination && onPageChange) {
                onPageChange(1);
              }
            }}
            placeholder={contract.dataset?.searchPlaceholder || "Search dataset"}
          />
        </label>
      ) : null}

      <div className={`table-shell ${contract.display.variant === "condensed" ? "condensed" : "full"}`}>
        {loading ? <div className="state-block">Loading dataset rows…</div> : null}
        {error ? <div className="state-block error-state">{error}</div> : null}
        {!loading && !error && rowModel.rows.length === 0 ? (
          <div className="state-block">{contract.display.emptyStateMessage}</div>
        ) : null}

        {!loading && !error && rowModel.rows.length > 0 ? (
          <div className={`table-scroll ${contract.display.horizontalScroll ? "allow-scroll" : ""}`}>
            <table className="data-table">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const columnStyles = getColumnStyles(header.column, contract.display.stickyHeader, true);
                      return (
                        <th
                          key={header.id}
                          className={`align-${(header.column.columnDef.meta as { align?: string } | undefined)?.align || "left"} ${
                            header.column.getIsPinned() ? "is-pinned" : ""
                          } ${contract.display.stickyHeader ? "is-sticky-header" : ""}`}
                          style={columnStyles}
                        >
                          {header.isPlaceholder ? null : (
                            <button
                              className={header.column.getCanSort() ? "sort-button" : "header-label"}
                              onClick={header.column.getToggleSortingHandler()}
                              type="button"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() ? (
                                <span className="sort-indicator">
                                  {header.column.getIsSorted() === "asc"
                                    ? "↑"
                                    : header.column.getIsSorted() === "desc"
                                      ? "↓"
                                      : "↕"}
                                </span>
                              ) : null}
                            </button>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rowModel.rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const columnStyles = getColumnStyles(cell.column, contract.display.stickyHeader);
                      return (
                        <td
                          key={cell.id}
                          className={`align-${(cell.column.columnDef.meta as { align?: string } | undefined)?.align || "left"} ${
                            cell.column.getIsPinned() ? "is-pinned" : ""
                          }`}
                          style={columnStyles}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {contract.display.paginationEnabled && pageCount > 1 ? (
        <div className="pagination-bar">
          <div className="muted">
            Page {currentPage} of {pageCount}
            {totalRowCount ? ` • ${totalRowCount} rows` : ""}
          </div>
          <div className="pagination-actions">
            <button
              type="button"
              onClick={() => {
                if (manualPagination && onPageChange) {
                  onPageChange(Math.max(currentPage - 1, 1));
                  return;
                }
                table.previousPage();
              }}
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => {
                if (manualPagination && onPageChange) {
                  onPageChange(Math.min(currentPage + 1, pageCount));
                  return;
                }
                table.nextPage();
              }}
              disabled={currentPage >= pageCount}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
