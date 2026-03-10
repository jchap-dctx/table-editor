import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import type { TableColumn, TableContract, TableRow } from "../types/table";
import {
  buildCanonicalInlineContract,
  createColumn,
  createUniqueKey,
  parseSpreadsheetText,
  slugifyKey,
  validateInlineTable,
} from "../utils/tableUtils";

type TableEditorProps = {
  contract: TableContract;
  onChange: (contract: TableContract) => void;
  onSave: (contract: TableContract) => void;
};

type ValidationSummary = ReturnType<typeof validateInlineTable>;

function getEmptyRow(columns: TableColumn[], rowIndex: number): TableRow {
  const row: TableRow = { id: `manual-row-${Date.now()}-${rowIndex}` };
  columns.forEach((column) => {
    row[column.key] = "";
  });
  return row;
}

function remapRowsForColumns(previousColumns: TableColumn[], nextColumns: TableColumn[], rows: TableRow[]): TableRow[] {
  return rows.map((row) => {
    const nextRow: TableRow = { id: row.id };
    nextColumns.forEach((column, index) => {
      const previousColumn = previousColumns[index];
      if (previousColumn && previousColumn.key in row) {
        nextRow[column.key] = row[previousColumn.key];
      } else if (column.key in row) {
        nextRow[column.key] = row[column.key];
      } else {
        nextRow[column.key] = "";
      }
    });
    return nextRow;
  });
}

export function TableEditor({ contract, onChange, onSave }: TableEditorProps) {
  const [pasteNotice, setPasteNotice] = useState("Paste a Google Sheets or Excel selection here.");
  const validation = useMemo<ValidationSummary>(
    () => validateInlineTable(contract.columns, contract.rows ?? []),
    [contract.columns, contract.rows],
  );

  function updateContract(partial: Partial<TableContract>) {
    onChange({ ...contract, ...partial });
  }

  function updateColumns(nextColumns: TableColumn[]) {
    const remappedRows = remapRowsForColumns(contract.columns, nextColumns, contract.rows ?? []);
    updateContract({ columns: nextColumns, rows: remappedRows });
  }

  function updateRow(rowId: string, key: string, value: string) {
    updateContract({
      rows: (contract.rows ?? []).map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        const column = contract.columns.find((entry) => entry.key === key);
        return {
          ...row,
          [key]: column?.type === "number" ? value : value,
        };
      }),
    });
  }

  function handlePaste(event: ChangeEvent<HTMLTextAreaElement>) {
    const text = event.target.value;
    if (!text.trim()) {
      return;
    }

    const parsed = parseSpreadsheetText(text);
    if (parsed.columns.length === 0) {
      setPasteNotice("No spreadsheet cells were detected.");
      return;
    }

    updateContract({
      columns: parsed.columns,
      rows: parsed.rows,
      title: "Pasted spreadsheet table",
      caption: "Generated from spreadsheet paste for quick editorial setup.",
    });
    setPasteNotice(`Imported ${parsed.rows.length} rows and ${parsed.columns.length} columns from pasted data.`);
    event.target.value = "";
  }

  function addColumn() {
    const usedKeys = new Set(contract.columns.map((column) => column.key));
    const key = createUniqueKey("new_column", usedKeys);
    const nextColumns = [...contract.columns, createColumn("New Column", key)];
    updateColumns(nextColumns);
  }

  function removeColumn(columnKey: string) {
    const nextColumns = contract.columns.filter((column) => column.key !== columnKey);
    updateContract({
      columns: nextColumns,
      rows: (contract.rows ?? []).map((row) => {
        const { [columnKey]: _removed, ...rest } = row;
        return rest as TableRow;
      }),
    });
  }

  function moveColumn(columnKey: string, direction: -1 | 1) {
    const currentIndex = contract.columns.findIndex((column) => column.key === columnKey);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= contract.columns.length) {
      return;
    }

    const nextColumns = [...contract.columns];
    const [moved] = nextColumns.splice(currentIndex, 1);
    nextColumns.splice(nextIndex, 0, moved);
    updateColumns(nextColumns);
  }

  function addRow() {
    const nextRows = [...(contract.rows ?? []), getEmptyRow(contract.columns, contract.rows?.length ?? 0)];
    updateContract({ rows: nextRows });
  }

  function removeRow(rowId: string) {
    updateContract({ rows: (contract.rows ?? []).filter((row) => row.id !== rowId) });
  }

  function updateColumn(columnKey: string, partial: Partial<TableColumn>) {
    const nextColumns = contract.columns.map((column) =>
      column.key === columnKey
        ? {
            ...column,
            ...partial,
          }
        : column,
    );
    updateColumns(nextColumns);
  }

  function saveTable() {
    const result = validateInlineTable(contract.columns, contract.rows ?? []);
    if (
      result.generalErrors.length > 0 ||
      Object.keys(result.columnErrors).length > 0 ||
      Object.keys(result.cellErrors).length > 0
    ) {
      return;
    }

    onSave(buildCanonicalInlineContract(contract));
  }

  const rowCountWarning = (contract.rows ?? []).length > 150;
  const columnCountWarning = contract.columns.length > 20;

  return (
    <section className="panel editor-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Table Editor</p>
          <h2>Inline authoring prototype</h2>
          <p className="muted">Spreadsheet-style editing, paste support, and live column configuration.</p>
        </div>
        <div className="action-row">
          <button type="button" onClick={addColumn}>
            Add column
          </button>
          <button type="button" onClick={addRow}>
            Add row
          </button>
          <button type="button" className="primary" onClick={saveTable}>
            Save table
          </button>
        </div>
      </div>

      <div className="stack">
        <div className="field-grid two-up">
          <label>
            <span>Title</span>
            <input value={contract.title || ""} onChange={(event) => updateContract({ title: event.target.value })} />
          </label>
          <label>
            <span>Table ID</span>
            <input
              value={contract.tableId}
              onChange={(event) => updateContract({ tableId: slugifyKey(event.target.value) })}
            />
          </label>
        </div>

        <label>
          <span>Caption</span>
          <textarea
            rows={2}
            value={contract.caption || ""}
            onChange={(event) => updateContract({ caption: event.target.value })}
          />
        </label>

        <div className="field-grid three-up">
          <label>
            <span>Variant</span>
            <select
              value={contract.display.variant}
              onChange={(event) =>
                updateContract({
                  display: {
                    ...contract.display,
                    variant: event.target.value as TableContract["display"]["variant"],
                  },
                })
              }
            >
              <option value="full">Full</option>
              <option value="condensed">Condensed</option>
            </select>
          </label>
          <label>
            <span>Page size</span>
            <input
              type="number"
              min={5}
              max={50}
              value={contract.display.pageSize}
              onChange={(event) =>
                updateContract({
                  display: {
                    ...contract.display,
                    pageSize: Number(event.target.value),
                  },
                })
              }
            />
          </label>
          <label>
            <span>Empty state message</span>
            <input
              value={contract.display.emptyStateMessage}
              onChange={(event) =>
                updateContract({
                  display: {
                    ...contract.display,
                    emptyStateMessage: event.target.value,
                  },
                })
              }
            />
          </label>
        </div>

        <div className="toggle-grid">
          {[
            ["searchEnabled", "Search"],
            ["sortingEnabled", "Sorting"],
            ["paginationEnabled", "Pagination"],
            ["stickyHeader", "Sticky header"],
            ["horizontalScroll", "Horizontal scroll"],
          ].map(([key, label]) => (
            <label key={key} className="checkbox">
              <input
                type="checkbox"
                checked={Boolean(contract.display[key as keyof typeof contract.display])}
                onChange={(event) =>
                  updateContract({
                    display: {
                      ...contract.display,
                      [key]: event.target.checked,
                    },
                  })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {(rowCountWarning || columnCountWarning) && (
          <div className="warning-banner">
            <strong>Large tables should use Dataset mode.</strong>
            <span>
              {rowCountWarning ? ` Rows: ${(contract.rows ?? []).length}.` : ""}
              {columnCountWarning ? ` Columns: ${contract.columns.length}.` : ""}
            </span>
          </div>
        )}

        <label>
          <span>Paste spreadsheet data</span>
          <textarea className="paste-zone" rows={4} onChange={handlePaste} placeholder={pasteNotice} />
          <small>{pasteNotice}</small>
        </label>

        {validation.generalErrors.length > 0 ? (
          <div className="error-list">
            {validation.generalErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}

        <div className="sheet-shell">
          <div className="table-scroll allow-scroll">
            <table className="editor-grid">
              <thead>
                <tr>
                  <th className="row-action-header">Row</th>
                  {contract.columns.map((column, index) => (
                    <th key={column.key}>
                      <div className="header-editor">
                        <input
                          value={column.label}
                          onChange={(event) => updateColumn(column.key, { label: event.target.value })}
                          placeholder="Label"
                        />
                        <input
                          value={column.key}
                          onChange={(event) => updateColumn(column.key, { key: slugifyKey(event.target.value) })}
                          placeholder="key"
                        />
                        <div className="header-actions">
                          <button type="button" onClick={() => moveColumn(column.key, -1)} disabled={index === 0}>
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumn(column.key, 1)}
                            disabled={index === contract.columns.length - 1}
                          >
                            →
                          </button>
                          <button type="button" onClick={() => removeColumn(column.key)}>
                            Remove
                          </button>
                        </div>
                        {validation.columnErrors[`column-${index}`]?.length ? (
                          <div className="inline-errors">
                            {validation.columnErrors[`column-${index}`].map((message) => (
                              <span key={message}>{message}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(contract.rows ?? []).map((row, rowIndex) => (
                  <tr key={row.id}>
                    <td className="row-action-cell">
                      <span>{rowIndex + 1}</span>
                      <button type="button" onClick={() => removeRow(row.id)}>
                        Remove
                      </button>
                      {validation.cellErrors[row.id]?.length ? <span className="cell-warning">Fix row</span> : null}
                    </td>
                    {contract.columns.map((column) => (
                      <td key={`${row.id}-${column.key}`}>
                        <input
                          value={String(row[column.key] ?? "")}
                          onChange={(event) => updateRow(row.id, column.key, event.target.value)}
                          className={validation.cellErrors[row.id]?.some((message) => message.includes(column.label)) ? "invalid" : ""}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <details className="details-panel" open>
          <summary>Column configuration</summary>
          <div className="column-config-list">
            {contract.columns.map((column) => (
              <div key={column.key} className="column-config-card">
                <div className="field-grid three-up">
                  <label>
                    <span>Label</span>
                    <input value={column.label} onChange={(event) => updateColumn(column.key, { label: event.target.value })} />
                  </label>
                  <label>
                    <span>Key</span>
                    <input value={column.key} onChange={(event) => updateColumn(column.key, { key: slugifyKey(event.target.value) })} />
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      value={column.type}
                      onChange={(event) =>
                        updateColumn(column.key, {
                          type: event.target.value as TableColumn["type"],
                          align: event.target.value === "number" ? "right" : column.align,
                        })
                      }
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="link">Link</option>
                      <option value="boolean">Boolean</option>
                      <option value="badge">Badge</option>
                      <option value="image">Image</option>
                    </select>
                  </label>
                </div>
                <div className="field-grid four-up">
                  <label>
                    <span>Align</span>
                    <select
                      value={column.align}
                      onChange={(event) => updateColumn(column.key, { align: event.target.value as TableColumn["align"] })}
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </label>
                  <label>
                    <span>Mobile priority</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={column.mobilePriority}
                      onChange={(event) =>
                        updateColumn(column.key, {
                          mobilePriority: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Width</span>
                    <input
                      type="number"
                      value={column.width ?? ""}
                      onChange={(event) => updateColumn(column.key, { width: event.target.value ? Number(event.target.value) : null })}
                    />
                  </label>
                  <label>
                    <span>Min width</span>
                    <input
                      type="number"
                      value={column.minWidth ?? ""}
                      onChange={(event) => updateColumn(column.key, { minWidth: event.target.value ? Number(event.target.value) : null })}
                    />
                  </label>
                </div>
                <div className="toggle-grid">
                  {[
                    ["sortable", "Sortable"],
                    ["searchable", "Searchable"],
                    ["visible", "Visible"],
                    ["pinnable", "Pinnable"],
                    ["pinned", "Pinned"],
                  ].map(([key, label]) => (
                    <label key={key} className="checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(column[key as keyof TableColumn])}
                        onChange={(event) =>
                          updateColumn(column.key, {
                            [key]: event.target.checked,
                          } as Partial<TableColumn>)
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
