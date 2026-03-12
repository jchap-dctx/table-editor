import type { ChangeEvent, ClipboardEvent, DragEvent } from "react";
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

export function TableEditor() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [storedValue, setStoredValue] = useValue();
  const isDisabled = useIsDisabled();

  const [isLoading, setIsLoading] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState<string>("Paste spreadsheet data or upload a .csv file.");
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [rawPasteText, setRawPasteText] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(false);
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
    setIsLoading(false);
  }, [storedValue]);

  useEffect(() => {
    const nextHeight = rootRef.current?.getBoundingClientRect().height;
    if (!nextHeight) {
      return;
    }

    CustomElement.setHeight(Math.ceil(nextHeight + 24));
  }, [payload, importErrors, loadWarnings, isLoading, savedMessage]);

  const validation = useMemo(() => validatePayload(payload, { importErrors }), [payload, importErrors]);
  const scale = useMemo(() => estimatePayloadScale(payload), [payload]);

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

    updateColumns([...payload.columns, createDefaultColumn(`Column ${index}`, key)]);
  }

  function setColumnKey(columnIndex: number, requestedKey: string) {
    const nextColumns = [...payload.columns];
    const target = nextColumns[columnIndex];
    if (!target) {
      return;
    }

    const baseKey = normalizeHeaderToKey(requestedKey || target.label || `column_${columnIndex + 1}`);
    const used = new Set(nextColumns.map((column, index) => (index === columnIndex ? "" : column.key)).filter(Boolean));

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
    const nextColumns = payload.columns.map((column, index) => (index === columnIndex ? { ...column, ...partial } : column));
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

  function moveColumn(columnIndex: number, direction: -1 | 1) {
    const nextIndex = columnIndex + direction;
    if (nextIndex < 0 || nextIndex >= payload.columns.length) {
      return;
    }

    const nextColumns = [...payload.columns];
    const [column] = nextColumns.splice(columnIndex, 1);
    nextColumns.splice(nextIndex, 0, column);
    updateColumns(nextColumns);
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

  function updateRowId(currentId: string, nextId: string) {
    const normalized = nextId.trim() || currentId;
    setPayload((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === currentId ? { ...row, id: normalized } : row)),
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
    const normalized = inferColumnsFromTabularData(matrix, firstRowIsHeader);
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
    setImportMessage(`Imported ${normalized.rows.length} rows and ${normalized.columns.length} columns from ${source}.`);
    setLastImport({
      source,
      rowCount: normalized.rows.length,
      columnCount: normalized.columns.length,
      importedAt: new Date().toLocaleTimeString(),
    });
  }

  function handlePasteFromTextarea() {
    const matrix = parseTabularText(rawPasteText);
    if (matrix.length === 0) {
      setImportErrors(["Paste area is empty or not parseable."]);
      return;
    }
    applyImportedMatrix(matrix, "paste");
    setRawPasteText("");
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const clipboard = event.clipboardData.getData("text/plain");
    if (!clipboard.trim()) {
      return;
    }

    const matrix = parseTabularText(clipboard);
    if (matrix.length === 0) {
      setImportErrors(["Clipboard data is not parseable as a table."]);
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

  function renderCellInput(row: InlineTableRow, column: InlineTableColumn) {
    const value = row[column.key];

    if (column.type === "boolean") {
      return (
        <select
          value={value === null ? "" : value === true ? "true" : value === false ? "false" : String(value)}
          onChange={(event) => updateCell(row.id, column, event.target.value)}
        >
          <option value="">Unset</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    return (
      <input
        type={column.type === "number" ? "text" : column.type === "date" ? "date" : column.type === "link" ? "url" : "text"}
        value={toInputValue(value)}
        onChange={(event) => updateCell(row.id, column, event.target.value)}
      />
    );
  }

  return (
    <div className="table-editor-root" ref={rootRef}>
      <header className="table-editor-header">
        <div>
          <p className="eyebrow">Custom Element / Inline Mode</p>
          <h1>Table Editor</h1>
          <p className="muted">Inline-only table authoring for small and medium datasets.</p>
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
          <div className="table-editor-grid two-up">
            <label>
              <span>Table ID</span>
              <input
                value={payload.tableId}
                onChange={(event) =>
                  setPayload((current) => ({
                    ...current,
                    tableId: normalizeHeaderToKey(event.target.value),
                  }))
                }
              />
            </label>
            <div className="table-editor-import-settings">
              <label className="table-editor-inline-checkbox">
                <input
                  type="checkbox"
                  checked={firstRowIsHeader}
                  onChange={(event) => setFirstRowIsHeader(event.target.checked)}
                />
                <span>Treat first imported row as header</span>
              </label>
            </div>
          </div>

          <div className="table-editor-import-grid">
            <div className="table-editor-upload-card">
              <p className="table-editor-upload-title">Drop CSV file here</p>
              <p className="muted table-editor-upload-subtitle">or click to upload</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="table-editor-upload-cta"
              >
                Click to upload
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
              >
                Drag and drop a .csv file here
              </div>
            </div>

            <div className="table-editor-import-actions">
              <button type="button" onClick={() => setShowPasteArea((current) => !current)}>
                {showPasteArea ? "Hide paste input" : "Paste from Google Sheets/Excel instead"}
              </button>
            </div>

            {showPasteArea ? (
              <div className="table-editor-paste-panel">
                <label>
                  <span>Paste tabular text</span>
                  <textarea
                    rows={5}
                    value={rawPasteText}
                    onPaste={handlePaste}
                    onChange={(event) => setRawPasteText(event.target.value)}
                    placeholder="Paste table data from Google Sheets or Excel"
                  />
                </label>
                <button type="button" onClick={handlePasteFromTextarea}>
                  Import pasted text
                </button>
              </div>
            ) : null}

            {lastImport ? (
              <div className="table-editor-ok table-editor-import-summary">
                Loaded successfully from <strong>{lastImport.source.toUpperCase()}</strong> at {lastImport.importedAt}.{" "}
                {lastImport.rowCount} rows and {lastImport.columnCount} columns are ready.
              </div>
            ) : (
              <div className="table-editor-import-summary muted">
                Import a CSV or paste spreadsheet data to generate the table automatically.
              </div>
            )}

            <div className="table-editor-inline-preview">
              <p className="table-editor-preview-label">Quick preview</p>
              <div className="table-editor-table-scroll">
                <table className="table-editor-preview-table">
                  <thead>
                    <tr>
                      {payload.columns.slice(0, 6).map((column) => (
                        <th key={`import-preview-${column.key}`}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payload.rows.slice(0, 3).map((row) => (
                      <tr key={`import-preview-row-${row.id}`}>
                        {payload.columns.slice(0, 6).map((column) => (
                          <td key={`import-preview-${row.id}-${column.key}`}>{toInputValue(row[column.key])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="muted">{importMessage}</p>
          </div>
        </section>

        <section className="table-editor-panel">
          <div className="table-editor-section-header">
            <h2>Columns</h2>
            <button type="button" onClick={addColumn}>
              Add column
            </button>
          </div>
          <div className="table-editor-column-list">
            {payload.columns.map((column, index) => (
              <article className="table-editor-column-card" key={column.key}>
                <div className="table-editor-column-row">
                  <label>
                    <span>Label</span>
                    <input value={column.label} onChange={(event) => updateColumn(index, { label: event.target.value })} />
                  </label>
                  <label>
                    <span>Key</span>
                    <input value={column.key} onChange={(event) => setColumnKey(index, event.target.value)} />
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      value={column.type}
                      onChange={(event) => updateColumn(index, { type: event.target.value as InlineColumnType })}
                    >
                      <option value="text">text</option>
                      <option value="number">number</option>
                      <option value="date">date</option>
                      <option value="link">link</option>
                      <option value="boolean">boolean</option>
                    </select>
                  </label>
                </div>

                <div className="table-editor-column-row compact">
                  <label>
                    <span>Align</span>
                    <select value={column.align} onChange={(event) => updateColumn(index, { align: event.target.value as InlineTableColumn["align"] })}>
                      <option value="left">left</option>
                      <option value="center">center</option>
                      <option value="right">right</option>
                    </select>
                  </label>
                  <label>
                    <span>Mobile Priority</span>
                    <input
                      type="number"
                      min={1}
                      value={column.mobilePriority}
                      onChange={(event) => updateColumn(index, { mobilePriority: Number(event.target.value) || 1 })}
                    />
                  </label>
                  <label>
                    <span>Width</span>
                    <input
                      type="number"
                      min={0}
                      value={column.width ?? ""}
                      onChange={(event) => updateColumn(index, { width: event.target.value ? Number(event.target.value) : null })}
                    />
                  </label>
                  <label>
                    <span>Min Width</span>
                    <input
                      type="number"
                      min={0}
                      value={column.minWidth ?? ""}
                      onChange={(event) => updateColumn(index, { minWidth: event.target.value ? Number(event.target.value) : null })}
                    />
                  </label>
                  <label>
                    <span>Formatter</span>
                    <input
                      value={column.formatter ?? ""}
                      onChange={(event) => updateColumn(index, { formatter: event.target.value || null })}
                    />
                  </label>
                </div>

                <div className="table-editor-toggle-row">
                  <label className="table-editor-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={column.sortable}
                      onChange={(event) => updateColumn(index, { sortable: event.target.checked })}
                    />
                    <span>sortable</span>
                  </label>
                  <label className="table-editor-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={column.searchable}
                      onChange={(event) => updateColumn(index, { searchable: event.target.checked })}
                    />
                    <span>searchable</span>
                  </label>
                  <label className="table-editor-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={column.pinnable}
                      onChange={(event) => updateColumn(index, { pinnable: event.target.checked })}
                    />
                    <span>pinnable</span>
                  </label>
                  <label className="table-editor-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={column.pinned}
                      onChange={(event) => updateColumn(index, { pinned: event.target.checked })}
                    />
                    <span>pinned</span>
                  </label>
                  <label className="table-editor-inline-checkbox">
                    <input
                      type="checkbox"
                      checked={column.visible}
                      onChange={(event) => updateColumn(index, { visible: event.target.checked })}
                    />
                    <span>visible</span>
                  </label>
                </div>

                <div className="table-editor-column-actions">
                  <button type="button" onClick={() => moveColumn(index, -1)} disabled={index === 0}>
                    Move left
                  </button>
                  <button
                    type="button"
                    onClick={() => moveColumn(index, 1)}
                    disabled={index === payload.columns.length - 1}
                  >
                    Move right
                  </button>
                  <button type="button" onClick={() => removeColumn(index)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="table-editor-panel">
          <div className="table-editor-section-header">
            <h2>Rows</h2>
            <button type="button" onClick={addRow}>
              Add row
            </button>
          </div>
          <div className="table-editor-table-scroll">
            <table className="table-editor-grid-table">
              <thead>
                <tr>
                  <th>id</th>
                  {payload.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {payload.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input value={row.id} onChange={(event) => updateRowId(row.id, event.target.value)} />
                    </td>
                    {payload.columns.map((column) => (
                      <td key={`${row.id}-${column.key}`}>{renderCellInput(row, column)}</td>
                    ))}
                    <td>
                      <button type="button" onClick={() => removeRow(row.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </fieldset>

      <section className="table-editor-panel">
        <h2>Preview</h2>
        <div className="table-editor-table-scroll">
          <table className="table-editor-preview-table">
            <thead>
              <tr>
                {payload.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.rows.slice(0, 6).map((row) => (
                <tr key={`preview-${row.id}`}>
                  {payload.columns.map((column) => (
                    <td key={`preview-${row.id}-${column.key}`}>{toInputValue(row[column.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
            <div className="table-editor-warn">
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
          <h2>Inline Scale Guardrail</h2>
          <p>
            Rows: <strong>{scale.rowCount}</strong> / 150, Columns: <strong>{scale.columnCount}</strong> / 20, Payload size: <strong>{scale.payloadBytes}</strong> bytes.
          </p>
          {scale.exceedsInlineLimit ? (
            <div className="table-editor-warn">
              <p>This table exceeds practical Inline limits. Save is blocked; use Dataset mode for larger tables.</p>
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
      </div>
    </div>
  );
}
