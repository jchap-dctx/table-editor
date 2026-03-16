import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  DragEvent,
  FormEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIsDisabled, useItemInfo, useValue, useVariantInfo } from "../../context";
import { parseCsvFile } from "./csv";
import {
  buildPayloadFromGrid,
  createDefaultColumn,
  createEmptyPayload,
  estimatePayloadScale,
  getTableEditorDraftStorageKey,
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
  const hasInitializedRef = useRef(false);
  const [storedValue, setStoredValue] = useValue();
  const isDisabled = useIsDisabled();
  const item = useItemInfo();
  const variant = useVariantInfo();

  const [isLoading, setIsLoading] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
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
  const [lastImportStatus, setLastImportStatus] = useState<"idle" | "success" | "too-large">("idle");
  const [payload, setPayload] = useState<InlineTablePayloadV1>(createEmptyPayload());
  const [hasUserChanges, setHasUserChanges] = useState(false);
  const storageKey = useMemo(() => getTableEditorDraftStorageKey(item.id, variant.codename), [item.id, variant.codename]);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    const parsed = parseStoredPayload(storedValue);
    let nextPayload = parsed.payload;
    let nextImport: typeof lastImport = null;
    let nextImportStatus: typeof lastImportStatus = "idle";

    const serializedDraft = window.localStorage.getItem(storageKey);
    if (serializedDraft) {
      try {
        const draft = JSON.parse(serializedDraft) as {
          payload?: InlineTablePayloadV1;
          lastImport?: typeof lastImport;
          lastImportStatus?: typeof lastImportStatus;
        };

        if (draft.payload) {
          nextPayload = draft.payload;
        }
        nextImport = draft.lastImport ?? null;
        nextImportStatus = draft.lastImportStatus ?? "idle";
      } catch (error) {
        console.warn("Unable to restore table editor draft state.", error);
      }
    }

    setPayload(nextPayload);
    setLoadWarnings(parsed.warnings);
    setLastImport(nextImport);
    setLastImportStatus(nextImportStatus);
    setSelectedColumnIndex(0);
    setHasUserChanges(false);
    setIsLoading(false);
  }, [storageKey, storedValue]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        payload,
        lastImport,
        lastImportStatus,
      }),
    );
  }, [isLoading, lastImport, lastImportStatus, payload, storageKey]);

  useEffect(() => {
    const nextHeight = rootRef.current?.getBoundingClientRect().height;
    if (!nextHeight) {
      return;
    }

    CustomElement.setHeight(Math.ceil(nextHeight + 24));
  }, [payload, importErrors, loadWarnings, isLoading, selectedColumnIndex]);

  useEffect(() => {
    if (payload.columns.length === 0) {
      setSelectedColumnIndex(0);
      return;
    }

    if (selectedColumnIndex > payload.columns.length - 1) {
      setSelectedColumnIndex(payload.columns.length - 1);
    }
  }, [payload.columns.length, selectedColumnIndex]);

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
  const selectedColumn = payload.columns[selectedColumnIndex] ?? null;
  const selectedColumnLabel = selectedColumn?.label?.trim() || "Selected column";
  const hasPersistedInlinePayload =
    storedValue !== null && storedValue !== undefined && !(typeof storedValue === "string" && !storedValue.trim());

  useEffect(() => {
    if (isLoading || isDisabled || !hasUserChanges || !validation.isValid || scale.exceedsInlineLimit) {
      return;
    }

    const serializedPayload = JSON.stringify(normalizedPreviewPayload);
    if (storedValue === serializedPayload) {
      setHasUserChanges(false);
      return;
    }

    setStoredValue(serializedPayload);
    setLastImportStatus("success");
    setHasUserChanges(false);
  }, [
    hasUserChanges,
    isDisabled,
    isLoading,
    normalizedPreviewPayload,
    scale.exceedsInlineLimit,
    setStoredValue,
    storedValue,
    validation.isValid,
  ]);

  function updatePayloadState(
    updater:
      | InlineTablePayloadV1
      | ((current: InlineTablePayloadV1) => InlineTablePayloadV1),
  ) {
    setHasUserChanges(true);
    setPayload(updater);
  }

  function updateColumns(nextColumns: InlineTableColumn[]) {
    updatePayloadState((current) => ({
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

    updatePayloadState((current) => {
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

    updatePayloadState((current) => ({
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
    updatePayloadState((current) => ({
      ...current,
      rows: [...current.rows, createEmptyRow(current.columns, current.rows.length)],
    }));
  }

  function removeRow(rowId: string) {
    updatePayloadState((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.id !== rowId),
    }));
  }

  function updateCell(rowId: string, column: InlineTableColumn, nextValue: string) {
    updatePayloadState((current) => ({
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
      setLastImport(null);
      setLastImportStatus("idle");
      return;
    }

    const importedAt = new Date().toLocaleTimeString();
    const nextPayload = buildPayloadFromGrid({
      tableId: payload.tableId || "inline-table",
      columns: normalized.columns,
      rows: normalized.rows,
      metadata: payload.metadata,
    });
    const nextScale = estimatePayloadScale(nextPayload);

    updatePayloadState((current) => ({
      ...nextPayload,
      tableId: current.tableId || nextPayload.tableId,
      metadata: current.metadata,
    }));

    setLastImport({
      source,
      rowCount: normalized.rows.length,
      columnCount: normalized.columns.length,
      importedAt,
    });
    setSelectedColumnIndex(0);

    if (nextScale.exceedsInlineLimit) {
      setStoredValue(null);
      setImportErrors([]);
      setLastImportStatus("too-large");
      return;
    }

    setImportErrors([]);
    setLastImportStatus("success");
  }

  function getColumnPresentationStyle(
    column: InlineTableColumn,
  ): { width?: number; minWidth?: number; maxWidth?: number; textAlign: InlineTableColumn["align"] } {
    return {
      ...getColumnWidthStyle(column),
      textAlign: column.align,
    };
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
      setLastImport(null);
      setLastImportStatus("idle");
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
      setLastImport(null);
      setLastImportStatus("idle");
      return;
    }

    const parsed = await parseCsvFile(file);
    if (parsed.errors.length > 0) {
      setImportErrors(parsed.errors);
      setLastImport(null);
      setLastImportStatus("idle");
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
      };
    }

    if (column.minWidth && column.minWidth > 0) {
      return { minWidth: column.minWidth };
    }

    return {};
  }

  function renderCellInput(row: InlineTableRow, column: InlineTableColumn) {
    const value = row[column.key];

    if (column.type === "boolean") {
      return (
        <select
          className="table-editor-cell-input"
          style={{ textAlign: column.align }}
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
          style={{ textAlign: column.align }}
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
        style={{ textAlign: column.align }}
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
      <div className="table-editor-toolbar">
        <p className="muted table-editor-toolbar-note">
          Click inside this custom element before pasting from Sheets or Excel.
        </p>
      </div>

      {isLoading ? <p className="muted table-editor-status">Loading existing field value...</p> : null}
      {loadWarnings.length > 0 ? (
        <div className="table-editor-warn table-editor-status">
          {loadWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {scale.exceedsInlineLimit ? (
        <div className="table-editor-warn table-editor-status">
          <p>
            This table is too large for Inline mode.
            {lastImport ? (
              <>
                {" "}
                Import not saved. You tried to import <strong>{lastImport.rowCount}</strong> rows and{" "}
                <strong>{lastImport.columnCount}</strong> columns from{" "}
                <strong>{lastImport.source.toUpperCase()}</strong>. Use the Dataset Source section
                for larger tables.
              </>
            ) : (
              <> Use the Dataset Source section for larger tables.</>
            )}
          </p>
        </div>
      ) : null}
      {importErrors.length > 0 ? (
        <div className="table-editor-warn table-editor-status" role="alert">
          <p>{importErrors[0]}</p>
        </div>
      ) : null}

      <fieldset disabled={isDisabled || isLoading} className="table-editor-fieldset">
        <section className="table-editor-panel table-editor-panel--flat">
          <div className="table-editor-upload-shell">
            <div className="table-editor-upload-copy">
              <h2>Import table data</h2>
              <p className="muted">
                Drop a CSV file, click to upload, or paste spreadsheet data after clicking into this
                editor. The first row is always treated as the header row.
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
                CSV only. Paste from Sheets/Excel works after the editor is focused.
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

            {lastImport && lastImportStatus === "success" && hasPersistedInlinePayload && !scale.exceedsInlineLimit ? (
            <div className="table-editor-ok table-editor-import-summary" role="status" aria-live="polite">
              Imported successfully from <strong>{lastImport.source.toUpperCase()}</strong> at {lastImport.importedAt}.{" "}
                {lastImport.rowCount} rows and {lastImport.columnCount} columns are ready.
              </div>
            ) : (
              <div className="table-editor-import-summary muted">
                Start with CSV or paste, then refine the grid directly below.
              </div>
            )}
          </div>
        </section>

        {payload.columns.length > 0 && hasPersistedInlinePayload && !scale.exceedsInlineLimit ? (
        <section className="table-editor-panel table-editor-panel--flat">
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
                        <td key={`${row.id}-${column.key}`} style={getColumnPresentationStyle(column)}>
                          {renderCellInput(row, column)}
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
                    The first column is pinned automatically. Reorder in the grid by dragging the header,
                    then review the final presentation in the Table Preview element.
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
        ) : null}
      </fieldset>
    </div>
  );
}
