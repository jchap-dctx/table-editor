import { useMemo, useState } from "react";
import { buildPayloadFromGrid, createEmptyPayload, parseStoredPayload } from "./helpers";
import type { InlineTableColumn, InlineTablePayloadV1 } from "./types";
import "./table-editor.css";

const LOCAL_PREVIEW_STORAGE_KEY = "table-editor:last-saved-payload";

function formatPreviewCell(column: InlineTableColumn, value: unknown): string {
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

function getColumnWidthStyle(column: InlineTableColumn): { width?: number; minWidth?: number } {
  if (column.width && column.width > 0) {
    return { width: column.width, minWidth: column.width };
  }

  if (column.minWidth && column.minWidth > 0) {
    return { minWidth: column.minWidth };
  }

  return {};
}

export function TableEditorPreview() {
  const initialValue =
    typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_PREVIEW_STORAGE_KEY) ?? "" : "";
  const [rawPayload, setRawPayload] = useState(initialValue);

  const parsed = useMemo(() => parseStoredPayload(rawPayload), [rawPayload]);
  const payload: InlineTablePayloadV1 = useMemo(() => {
    if (!rawPayload.trim()) {
      return createEmptyPayload();
    }

    return buildPayloadFromGrid({
      tableId: parsed.payload.tableId,
      columns: parsed.payload.columns,
      rows: parsed.payload.rows,
      metadata: parsed.payload.metadata,
    });
  }, [parsed.payload, rawPayload]);

  return (
    <div className="table-editor-root table-editor-preview-page">
      <section className="table-editor-panel table-editor-panel--flat">
        <div className="table-editor-section-header">
          <div>
            <h2>Preview harness</h2>
            <p className="muted">
              Paste saved JSON from Kontent or use the last payload stored by the custom element.
            </p>
          </div>
        </div>
        <label className="table-editor-preview-json-input">
          <span>Payload JSON</span>
          <textarea
            rows={10}
            value={rawPayload}
            onChange={(event) => setRawPayload(event.target.value)}
            placeholder="Paste a saved table payload here"
          />
        </label>
        {parsed.warnings.length > 0 ? (
          <div className="table-editor-warn">
            {parsed.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="table-editor-panel table-editor-panel--flat">
        <div className="table-editor-section-header">
          <div>
            <h2>Rendered output</h2>
            <p className="muted">A lightweight renderer for checking the saved JSON shape and output.</p>
          </div>
        </div>
        <div className="table-editor-preview-summary">
          <div className="table-editor-preview-chip">
            <span className="table-editor-preview-chip-label">Columns</span>
            <strong>{payload.columns.length}</strong>
          </div>
          <div className="table-editor-preview-chip">
            <span className="table-editor-preview-chip-label">Rows</span>
            <strong>{payload.rows.length}</strong>
          </div>
          <div className="table-editor-preview-chip">
            <span className="table-editor-preview-chip-label">Version</span>
            <strong>{payload.version}</strong>
          </div>
        </div>
        <div className="table-editor-module-preview">
          <div className="table-editor-table-scroll table-editor-rendered-preview">
            <table className="table-editor-preview-table table-editor-rendered-table">
              <colgroup>
                {payload.columns.map((column) => (
                  <col key={`harness-col-${column.key}`} style={getColumnWidthStyle(column)} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {payload.columns.map((column) => (
                    <th key={`harness-head-${column.key}`} style={getColumnWidthStyle(column)}>
                      <span className="table-editor-rendered-head-label">{column.label}</span>
                      <span className="table-editor-rendered-head-meta">{column.type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.rows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(payload.columns.length, 1)} className="table-editor-empty-preview">
                      No rows available for preview.
                    </td>
                  </tr>
                ) : (
                  payload.rows.map((row) => (
                    <tr key={`harness-row-${row.id}`}>
                      {payload.columns.map((column) => (
                        <td key={`harness-${row.id}-${column.key}`} style={getColumnWidthStyle(column)}>
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
    </div>
  );
}
