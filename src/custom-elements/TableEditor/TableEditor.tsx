import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  DragEvent,
  FormEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIsDisabled, useValue } from "../../context";
import { parseCsvFile } from "./csv";
import {
  buildPayloadFromGrid,
  createDefaultColumn,
  createEmptyPayload,
  estimatePayloadScale,
  inferColumnsFromTabularData,
  normalizeHeaderToKey,
  parseStoredPayload,
  parseTabularText,
  validatePayload,
} from "./helpers";
import type {
  InlineCellValue,
  InlineColumnType,
  InlineTableColumn,
  InlineTablePayloadV1,
  InlineTableRow,
} from "./types";
import "./table-editor.css";

function generateRowId(index: number): string {
  return `row-${Date.now()}-${index}`;
}

function createEmptyRow(columns: InlineTableColumn[], rowIndex: number): InlineTableRow {
  const row: InlineTableRow = {
    id: generateRowId(rowIndex),
  };

  for (const column of columns) {
    row[column.key] = null;
  }

  return row;
}

function toInputValue(value: InlineCellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function formatPreviewCell(column: InlineTableColumn, value: InlineCellValue): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (column.type === "boolean") {
    return value === true ? "Yes" : value === false ? "No" : String(value);
  }

  if (column.type === "date") {
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString();
    }
  }

  return String(value);
}

function coerceInputByType(type: InlineColumnType, nextValue: string): InlineCellValue {
  if (!nextValue) {
    return null;
  }

  if (type === "number") {
    const numeric = Number(nextValue);
    return Number.isNaN(numeric) ? nextValue : numeric;
  }

  if (type === "boolean") {
    if (nextValue === "true") {
      return true;
    }
    if (nextValue === "false") {
      return false;
    }
  }

  return nextValue;
}

function syncRowsToColumns(rows: InlineTableRow[], columns: InlineTableColumn[]): InlineTableRow[] {
  return rows.map((row, rowIndex) => {
    const next: InlineTableRow = { id: row.id || generateRowId(rowIndex) };
    columns.forEach((column) => {
      next[column.key] = row[column.key] ?? null;
    });
    return next;
  });
}

function isEditablePasteTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

export function TableEditor() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resizeStateRef = useRef<{
    columnIndex: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [storedValue, setStoredValue] = useValue();
  const isDisabled = useIsDisabled();

  const [isLoading, setIsLoading] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState<string>(
    "Drop a CSV or paste spreadsheet data anywhere on the page. The first row is always used as headers.",
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    targetIndex: number;
    placement: "before" | "after";
  } | null>(null);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number>(0);
  const [lastImport, setLastImport] = useState<{
    source: "paste" | "csv";
    rowCount: number;
    columnCount: number;
    importedAt: string;
  } | null>(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [payload, setPayload] = useState<InlineTablePayloadV1>(createEmptyPayload());

  useEffect(() => {
    const parsed = parseStoredPayload(storedValue);
    setPayload(parsed.payload);
    setLoadWarnings(parsed.warnings);
    setSelectedColumnIndex(0);
    setIsLoading(false);
  }, [storedValue]);

  useEffect(() => {
    const nextHeight = rootRef.current?.getBoundingClientRect().height;
    if (!nextHeight) {
      return;
    }

    CustomElement.setHeight(Math.ceil(nextHeight + 24));
  }, [payload, importErrors, loadWarnings, isLoading, savedMessage, selectedColumnIndex]);

  useEffect(() => {
    if (payload.columns.length === 0) {
      setSelectedColumnIndex(0);
      return;
    }

    if (selectedColumnIndex > payload.columns.length - 1) {
      setSelectedColumnIndex(payload.columns.length - 1);
    }
  }, [payload.columns.length, selectedColumnIndex]);

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const nextWidth = Math.max(80, Math.round(resizeState.startWidth + (event.clientX - resizeState.startX)));
      updateColumn(resizeState.columnIndex, { width: nextWidth });
    }

    function handlePointerUp() {
      resizeStateRef.current = null;
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [payload.columns]);

  const validation = useMemo(
    () => validatePayload(payload, { importErrors }),
    [payload, importErrors],
  );
  const scale = useMemo(() => estimatePayloadScale(payload), [payload]);
  const normalizedPreviewPayload = useMemo(
    () =>
      buildPayloadFromGrid({
        tableId: payload.tableId,
        columns: payload.columns,
        rows: payload.rows,
        metadata: payload.metadata,
      }),
    [payload],
  );
  const savedPayloadString =
    typeof storedValue === "string" && storedValue.trim() ? storedValue : null;
  const selectedColumn = payload.columns[selectedColumnIndex] ?? null;
  const selectedColumnLabel = selectedColumn?.label?.trim() || "Selected column";

  const canSave = !isDisabled && !isLoading && validation.isValid && !scale.exceedsInlineLimit;

  function updateColumns(nextColumns: InlineTableColumn[]) {
    setPayload((current) => ({
      ...current,
      columns: nextColumns,
      rows: syncRowsToColumns(current.rows, nextColumns),
    }));
  }

  function addColumn() {
    const usedKeys = new Set(payload.columns.map((column) => column.key));
    let index = payload.columns.length + 1;
    let key = normalizeHeaderToKey(`column_${index}`);
    while (usedKeys.has(key)) {
      index += 1;
      key = normalizeHeaderToKey(`column_${index}`);
    }

    const nextColumns = [...payload.columns, createDefaultColumn(`Column ${index}`, key)];
    updateColumns(nextColumns);
    setSelectedColumnIndex(nextColumns.length - 1);
  }

  function setColumnKey(columnIndex: number, requestedKey: string) {
    const nextColumns = [...payload.columns];
    const target = nextColumns[columnIndex];
    if (!target) {
      return;
    }

    const baseKey = normalizeHeaderToKey(
      requestedKey || target.label || `column_${columnIndex + 1}`,
    );
    const used = new Set(
      nextColumns
        .map((column, index) => (index === columnIndex ? "" : column.key))
        .filter(Boolean),
    );

    let uniqueKey = baseKey;
    let suffix = 2;
    while (used.has(uniqueKey)) {
      uniqueKey = `${baseKey}_${suffix}`;
      suffix += 1;
    }

    const oldKey = target.key;
    nextColumns[columnIndex] = { ...target, key: uniqueKey };

    setPayload((current) => {
      const nextRows = current.rows.map((row) => {
        const { [oldKey]: oldValue, ...rest } = row;
        return {
          ...rest,
          [uniqueKey]: oldValue ?? null,
        } as InlineTableRow;
      });

      return {
        ...current,
        columns: nextColumns,
        rows: syncRowsToColumns(nextRows, nextColumns),
      };
    });
  }

  function updateColumn(columnIndex: number, partial: Partial<InlineTableColumn>) {
    const nextColumns = payload.columns.map((column, index) =>
      index === columnIndex ? { ...column, ...partial } : column,
    );
    updateColumns(nextColumns);
  }

  function removeColumn(columnIndex: number) {
    const column = payload.columns[columnIndex];
    if (!column) {
      return;
    }

    const nextColumns = payload.columns.filter((_, index) => index !== columnIndex);
    const nextRows = payload.rows.map((row) => {
      const { [column.key]: removed, ...rest } = row;
      void removed;
      return rest as InlineTableRow;
    });

    setPayload((current) => ({
      ...current,
      columns: nextColumns,
      rows: syncRowsToColumns(nextRows, nextColumns),
    }));
  }

  function reorderColumns(
    sourceIndex: number,
    targetIndex: number,
    placement: "before" | "after",
  ) {
    let destinationIndex = placement === "after" ? targetIndex + 1 : targetIndex;
    if (sourceIndex < destinationIndex) {
      destinationIndex -= 1;
    }

    if (sourceIndex === destinationIndex) {
      return;
    }

    const nextColumns = [...payload.columns];
    const [column] = nextColumns.splice(sourceIndex, 1);
    nextColumns.splice(destinationIndex, 0, column);
    updateColumns(nextColumns);
    setSelectedColumnIndex(destinationIndex);
  }

  function addRow() {
    setPayload((current) => ({
      ...current,
      rows: [...current.rows, createEmptyRow(current.columns, current.rows.length)],
    }));
  }

  function removeRow(rowId: string) {
    setPayload((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.id !== rowId),
    }));
  }

  function updateCell(rowId: string, column: InlineTableColumn, nextValue: string) {
    setPayload((current) => ({
      ...current,
      rows: current.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [column.key]: coerceInputByType(column.type, nextValue),
            }
          : row,
      ),
    }));
  }

  function applyImportedMatrix(matrix: string[][], source: "paste" | "csv") {
    const normalized = inferColumnsFromTabularData(matrix, true);
    if (normalized.columns.length === 0) {
      setImportErrors(["Imported data did not contain parseable tabular values."]);
      return;
    }

    setPayload((current) =>
      buildPayloadFromGrid({
        tableId: current.tableId || "inline-table",
        columns: normalized.columns,
        rows: normalized.rows,
        metadata: current.metadata,
      }),
    );

    setImportErrors([]);
    setImportMessage(
      `Imported ${normalized.rows.length} rows and ${normalized.columns.length} columns from ${source}.`,
    );
    setLastImport({
      source,
      rowCount: normalized.rows.length,
      columnCount: normalized.columns.length,
      importedAt: new Date().toLocaleTimeString(),
    });
    setSelectedColumnIndex(0);
  }

  function handleRootPaste(event: ReactClipboardEvent<HTMLDivElement>) {
    if (isEditablePasteTarget(event.target)) {
      return;
    }

    const clipboard = event.clipboardData.getData("text/plain");
    if (!clipboard.trim()) {
      return;
    }

    const matrix = parseTabularText(clipboard);
    if (matrix.length === 0) {
      return;
    }

    event.preventDefault();
    applyImportedMatrix(matrix, "paste");
  }

  async function onCsvSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const parsed = await parseCsvFile(file);
    if (parsed.errors.length > 0) {
      setImportErrors(parsed.errors);
      return;
    }

    applyImportedMatrix(parsed.matrix, "csv");
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (isDisabled) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith(".csv")) {
      setImportErrors(["Drop a .csv file to import data."]);
      return;
    }

    const parsed = await parseCsvFile(file);
    if (parsed.errors.length > 0) {
      setImportErrors(parsed.errors);
      return;
    }

    applyImportedMatrix(parsed.matrix, "csv");
  }

  function preventDropDefaults(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function openFilePicker() {
    if (!isDisabled) {
      fileInputRef.current?.click();
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isDisabled) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function savePayload() {
    const normalized = buildPayloadFromGrid({
      tableId: payload.tableId,
      columns: payload.columns,
      rows: payload.rows,
      metadata: payload.metadata,
    });

    const saveValidation = validatePayload(normalized, { importErrors });
    const saveScale = estimatePayloadScale(normalized);
    if (!saveValidation.isValid || saveScale.exceedsInlineLimit) {
      return;
    }

    setStoredValue(JSON.stringify(normalized));
    setPayload(normalized);
    setSavedMessage(`Saved at ${new Date().toLocaleTimeString()}.`);
  }

  function expandTextarea(element: HTMLTextAreaElement) {
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }

  function autoGrowTextarea(event: FormEvent<HTMLTextAreaElement>) {
    expandTextarea(event.currentTarget);
  }

  function getColumnWidthStyle(column: InlineTableColumn): { width?: number; minWidth?: number; maxWidth?: number } {
    if (column.width && column.width > 0) {
      return {
        width: column.width,
        minWidth: column.width,
        maxWidth: column.width,
      };
    }

    if (column.minWidth && column.minWidth > 0) {
      return { minWidth: column.minWidth };
    }

    return {};
  }

  function startPreviewResize(
    event: ReactMouseEvent<HTMLSpanElement>,
    columnIndex: number,
    column: InlineTableColumn,
  ) {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      columnIndex,
      startX: event.clientX,
      startWidth: column.width ?? column.minWidth ?? 180,
    };
  }

  function renderCellInput(row: InlineTableRow, column: InlineTableColumn) {
    const value = row[column.key];

    if (column.type === "boolean") {
      return (
        <select
          className="table-editor-cell-input"
          value={
            value === null
              ? ""
              : value === true
                ? "true"
                : value === false
                  ? "false"
                  : String(value)
          }
          onChange={(event) => updateCell(row.id, column, event.target.value)}
        >
          <option value="">Unset</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    if (column.type === "text" || column.type === "link") {
      return (
        <textarea
          className="table-editor-cell-input table-editor-cell-textarea"
          rows={1}
          value={toInputValue(value)}
          onChange={(event) => updateCell(row.id, column, event.target.value)}
          onInput={autoGrowTextarea}
          onFocus={(event) => expandTextarea(event.currentTarget)}
          onDoubleClick={(event) => expandTextarea(event.currentTarget)}
          placeholder={column.label}
        />
      );
    }

    return (
      <input
        className="table-editor-cell-input"
        type={
          column.type === "number"
            ? "text"
            : column.type === "date"
              ? "date"
              : "text"
        }
        value={toInputValue(value)}
        onChange={(event) => updateCell(row.id, column, event.target.value)}
        placeholder={column.label}
      />
    );
  }

  return (
    <div className="table-editor-root" ref={rootRef} onPasteCapture={handleRootPaste}>
      <header className="table-editor-header">
        <div>
          <p className="eyebrow">Custom Element / Inline Mode</p>
          <h1>Table Editor</h1>
          <p className="muted">
            Import a CSV or paste spreadsheet data, then shape the table directly in the live grid.
          </p>
        </div>
        <div className="table-editor-actions">
          <button type="button" className="primary" onClick={savePayload} disabled={!canSave}>
            Save payload
          </button>
        </div>
      </header>

      {isLoading ? <p className="muted table-editor-status">Loading existing field value...</p> : null}
      {savedMessage ? <p className="table-editor-ok table-editor-status">{savedMessage}</p> : null}
      {loadWarnings.length > 0 ? (
        <div className="table-editor-warn table-editor-status">
          {loadWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <fieldset disabled={isDisabled || isLoading} className="table-editor-fieldset">
        <section className="table-editor-panel">
          <div className="table-editor-upload-shell">
            <div className="table-editor-upload-copy">
              <h2>Import table data</h2>
              <p className="muted">
                Drop a CSV file, click to upload, or paste spreadsheet data anywhere on this page.
                The first row is always treated as the header row.
              </p>
            </div>
          </div>

          <div className="table-editor-import-grid">
            <div className="table-editor-upload-card">
              <div className="table-editor-upload-icon" aria-hidden="true">
                ↑
              </div>
              <p className="table-editor-upload-title">Click to upload or drag and drop</p>
              <p className="muted table-editor-upload-subtitle">
                CSV only. Paste from Sheets/Excel works anywhere on the canvas.
              </p>
              <button type="button" onClick={openFilePicker} className="table-editor-upload-cta">
                Choose CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onCsvSelected}
                className="table-editor-hidden-file-input"
              />
              <div
                className={`table-editor-dropzone ${isDragOver ? "is-drag-over" : ""}`}
                onDragOver={preventDropDefaults}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openFilePicker();
                  }
                }}
                role="button"
                tabIndex={isDisabled ? -1 : 0}
                aria-disabled={isDisabled}
                aria-label="Upload CSV file by click or drag and drop"
              >
                Drop CSV here
              </div>
            </div>

            {lastImport ? (
              <div className="table-editor-ok table-editor-import-summary" role="status" aria-live="polite">
                Loaded successfully from <strong>{lastImport.source.toUpperCase()}</strong> at {lastImport.importedAt}.{" "}
                {lastImport.rowCount} rows and {lastImport.columnCount} columns are ready.
              </div>
            ) : (
              <div className="table-editor-import-summary muted">
                Start with CSV or paste, then refine the grid directly below.
              </div>
            )}

            <p className="muted">{importMessage}</p>
          </div>
        </section>

        <section className="table-editor-panel">
          <div className="table-editor-section-header">
            <div>
              <h2>Live table builder</h2>
              <p className="muted">
                Edit values inline, drag headers to reorder columns, and use the side panel for light column cleanup.
              </p>
            </div>
            <div className="table-editor-builder-actions">
              <button type="button" onClick={addColumn}>
                Add column
              </button>
              <button type="button" onClick={addRow}>
                Add row
              </button>
            </div>
          </div>

          <div className="table-editor-builder-layout">
            <div className="table-editor-table-scroll table-editor-builder-grid">
              <table className="table-editor-grid-table table-editor-live-grid">
                <thead>
                  <tr>
                    <th className="table-editor-row-index-head">#</th>
                {payload.columns.map((column, index) => (
                      <th
                        key={column.key}
                        style={getColumnWidthStyle(column)}
                        draggable
                        onDragStart={() => setDraggedColumnIndex(index)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          const bounds = event.currentTarget.getBoundingClientRect();
                          const placement =
                            event.clientX - bounds.left < bounds.width / 2 ? "before" : "after";
                          setDropIndicator({ targetIndex: index, placement });
                        }}
                        onDragLeave={() => setDropIndicator(null)}
                        onDrop={() => {
                          if (draggedColumnIndex === null || dropIndicator === null) {
                            return;
                          }
                          reorderColumns(
                            draggedColumnIndex,
                            dropIndicator.targetIndex,
                            dropIndicator.placement,
                          );
                          setDraggedColumnIndex(null);
                          setDropIndicator(null);
                        }}
                        onDragEnd={() => {
                          setDraggedColumnIndex(null);
                          setDropIndicator(null);
                        }}
                        className={
                          [
                            "table-editor-column-head",
                            index === selectedColumnIndex ? "is-selected" : "",
                            dropIndicator?.targetIndex === index && dropIndicator.placement === "before"
                              ? "is-drop-before"
                              : "",
                            dropIndicator?.targetIndex === index && dropIndicator.placement === "after"
                              ? "is-drop-after"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")
                        }
                      >
                        <button
                          type="button"
                          className="table-editor-column-surface"
                          onClick={() => setSelectedColumnIndex(index)}
                          aria-pressed={index === selectedColumnIndex}
                        >
                          <div className="table-editor-column-topline">
                            <span className="table-editor-column-drag" aria-hidden="true">
                              ≡
                            </span>
                            <span className="table-editor-column-type-pill">{column.type}</span>
                          </div>
                          <div className="table-editor-column-copy">
                            <input
                              value={column.label}
                              onChange={(event) => updateColumn(index, { label: event.target.value })}
                              onClick={(event) => event.stopPropagation()}
                              className="table-editor-column-label-input"
                              aria-label={`Column ${index + 1} label`}
                            />
                            <span className="table-editor-column-meta">{column.key}</span>
                          </div>
                        </button>
                      </th>
                    ))}
                    <th className="table-editor-row-actions-head">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={payload.columns.length + 2}
                        className="table-editor-empty-preview"
                      >
                        No rows yet. Import a dataset or add rows manually.
                      </td>
                    </tr>
                  ) : (
                    payload.rows.map((row, rowIndex) => (
                      <tr key={row.id}>
                        <td className="table-editor-row-index-cell">{rowIndex + 1}</td>
                        {payload.columns.map((column) => (
                        <td key={`${row.id}-${column.key}`}>
                          <div style={getColumnWidthStyle(column)}>
                            {renderCellInput(row, column)}
                          </div>
                          </td>
                        ))}
                        <td className="table-editor-row-actions-cell">
                          <button type="button" onClick={() => removeRow(row.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <aside className="table-editor-column-sidebar">
              <div className="table-editor-column-sidebar-header">
                <div>
                  <h3>{selectedColumnLabel}</h3>
                  <p className="muted">Label, key, type, and alignment for the active column.</p>
                </div>
                {selectedColumn ? (
                  <span className="table-editor-column-badge">
                    {selectedColumnIndex + 1} / {payload.columns.length}
                  </span>
                ) : null}
              </div>

              {selectedColumn ? (
                <div className="table-editor-column-sidebar-form">
                  <label>
                    <span>Label</span>
                    <input
                      value={selectedColumn.label}
                      onChange={(event) =>
                        updateColumn(selectedColumnIndex, { label: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Key</span>
                    <input
                      value={selectedColumn.key}
                      onChange={(event) => setColumnKey(selectedColumnIndex, event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      value={selectedColumn.type}
                      onChange={(event) =>
                        updateColumn(selectedColumnIndex, {
                          type: event.target.value as InlineColumnType,
                        })
                      }
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="date">date</option>
                      <option value="link">link</option>
                      <option value="boolean">boolean</option>
                    </select>
                  </label>
                  <label>
                    <span>Align</span>
                    <select
                      value={selectedColumn.align}
                      onChange={(event) =>
                        updateColumn(selectedColumnIndex, {
                          align: event.target.value as InlineTableColumn["align"],
                        })
                      }
                    >
                      <option value="left">left</option>
                      <option value="center">center</option>
                      <option value="right">right</option>
                    </select>
                  </label>
                  <div className="table-editor-column-note muted">
                    The first column is pinned automatically. Reorder in the grid by dragging the header, then resize columns directly from the rendered preview.
                  </div>

                  <div className="table-editor-column-sidebar-actions">
                    <button
                      type="button"
                      onClick={() => removeColumn(selectedColumnIndex)}
                    >
                      Delete column
                    </button>
                  </div>
                </div>
              ) : (
                <p className="muted">
                  Add or import columns to start configuring the table structure.
                </p>
              )}
            </aside>
          </div>
        </section>
      </fieldset>

        <section className="table-editor-panel">
          <div className="table-editor-section-header">
            <div>
              <h2>Rendered preview</h2>
              <p className="muted">
                A cleaner table rendering based on the normalized JSON payload, styled closer to the data table module pattern.
              </p>
            </div>
          </div>
          <div className="table-editor-preview-summary">
            <div className="table-editor-preview-chip">
              <span className="table-editor-preview-chip-label">Columns</span>
              <strong>{normalizedPreviewPayload.columns.length}</strong>
            </div>
            <div className="table-editor-preview-chip">
              <span className="table-editor-preview-chip-label">Rows</span>
              <strong>{normalizedPreviewPayload.rows.length}</strong>
            </div>
            <div className="table-editor-preview-chip">
              <span className="table-editor-preview-chip-label">Source</span>
              <strong>Inline</strong>
            </div>
          </div>
          <div className="table-editor-module-preview">
            <div className="table-editor-table-scroll table-editor-rendered-preview">
              <table className="table-editor-preview-table table-editor-rendered-table">
              <thead>
              <tr>
                {normalizedPreviewPayload.columns.map((column, index) => (
                  <th key={`preview-${column.key}`} style={getColumnWidthStyle(column)}>
                    <span className="table-editor-rendered-head-label">{column.label}</span>
                    <span className="table-editor-rendered-head-meta">{column.type}</span>
                    <span
                      className="table-editor-column-resize-handle"
                      onMouseDown={(event) => startPreviewResize(event, index, column)}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${column.label} column`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalizedPreviewPayload.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(normalizedPreviewPayload.columns.length, 1)}
                    className="table-editor-empty-preview"
                  >
                    Import data to see the rendered table output here.
                  </td>
                </tr>
              ) : (
                normalizedPreviewPayload.rows.slice(0, 8).map((row) => (
                  <tr key={`rendered-${row.id}`}>
                    {normalizedPreviewPayload.columns.map((column) => (
                        <td key={`rendered-${row.id}-${column.key}`} style={getColumnWidthStyle(column)}>
                        <div className="table-editor-rendered-cell">
                          <span className="table-editor-rendered-cell-primary">
                            {formatPreviewCell(column, row[column.key])}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
            </div>
        </div>
      </section>

      <div className="table-editor-meta-grid">
        <section className="table-editor-panel">
          <h2>Validation</h2>
          {validation.generalErrors.length === 0 &&
          Object.keys(validation.columnErrors).length === 0 &&
          Object.keys(validation.rowErrors).length === 0 ? (
            <p className="table-editor-ok">No validation errors.</p>
          ) : null}

          {validation.generalErrors.length > 0 ? (
            <ul>
              {validation.generalErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}

          {Object.entries(validation.columnErrors).map(([key, errors]) => (
            <div key={key}>
              <strong>{key}</strong>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ))}

          {Object.entries(validation.rowErrors).map(([key, errors]) => (
            <div key={key}>
              <strong>{key}</strong>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ))}

          {importErrors.length > 0 ? (
            <div className="table-editor-warn" role="alert">
              <p>Import issues:</p>
              <ul>
                {importErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="table-editor-panel">
          <h2>Inline scale guardrail</h2>
          <p>
            Rows: <strong>{scale.rowCount}</strong> / 150, Columns:{" "}
            <strong>{scale.columnCount}</strong> / 20, Payload size:{" "}
            <strong>{scale.payloadBytes}</strong> bytes.
          </p>
          {scale.exceedsInlineLimit ? (
            <div className="table-editor-warn">
              <p>
                This table exceeds practical Inline limits. You can still inspect the imported
                data here, but save is blocked. Use the Dataset workflow for larger tables.
              </p>
              <ul>
                {scale.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="table-editor-ok">Current size is within the Inline recommendation.</p>
          )}
        </section>

        <section className="table-editor-panel">
          <h2>Saved payload JSON</h2>
          <p className="muted">
            This is the normalized JSON that will be stored in the custom element field.
          </p>
          <pre className="table-editor-json-panel">
            {savedPayloadString ?? JSON.stringify(normalizedPreviewPayload, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}
