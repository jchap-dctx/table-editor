import { useMemo } from "react";
import { useConfig, useValue } from "../../context";
import { useElements } from "../../helpers/selectors";
import { buildPayloadFromGrid, createEmptyPayload, parseStoredPayload } from "./helpers";
import type { InlineTableColumn, InlineTablePayloadV1 } from "./types";
import "./table-editor.css";

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
  const config = useConfig();
  const [storedValue] = useValue();
  const sourceElementCodenames = useMemo(() => {
    const fromConfig = [
      config.sourceElementCodename,
      config.sourceCodename,
      config.elementCodename,
      config.textElementCodename,
      ...(Array.isArray(config.sourceElementCodenames)
        ? config.sourceElementCodenames
        : typeof config.sourceElementCodenames === "string"
          ? config.sourceElementCodenames.split(",")
          : []),
    ];

    return fromConfig.map((value) => value?.trim()).filter(Boolean) as string[];
  }, [config]);
  const watchedElements = useElements(sourceElementCodenames);
  const watchedValue = sourceElementCodenames[0]
    ? watchedElements?.get(sourceElementCodenames[0]) ?? null
    : null;
  const previewSourceValue = watchedValue ?? storedValue;
  const parsed = useMemo(() => parseStoredPayload(previewSourceValue), [previewSourceValue]);
  const payload: InlineTablePayloadV1 = useMemo(() => {
    if (!previewSourceValue || (typeof previewSourceValue === "string" && !previewSourceValue.trim())) {
      return createEmptyPayload();
    }

    return buildPayloadFromGrid({
      tableId: parsed.payload.tableId,
      columns: parsed.payload.columns,
        rows: parsed.payload.rows,
        metadata: parsed.payload.metadata,
      });
  }, [parsed.payload, previewSourceValue]);
  const previewSourceLabel = sourceElementCodenames[0] ?? "this element";

  return (
    <div className="table-editor-root table-editor-preview-page">
      <section className="table-editor-panel table-editor-panel--flat">
        <div className="table-editor-section-header">
          <div>
            <h2>Table preview</h2>
            <p className="muted">Rendering the saved inline table payload from {previewSourceLabel}.</p>
          </div>
        </div>
        {parsed.warnings.length > 0 ? (
          <div className="table-editor-warn">
            {parsed.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        {sourceElementCodenames.length === 0 ? (
          <div className="table-editor-warn">
            <p>
              Add <code>sourceElementCodename</code> in this custom element&apos;s JSON parameters to
              point at the inline table field you want to preview.
            </p>
          </div>
        ) : null}
        {payload.columns.length === 0 && parsed.warnings.length === 0 ? (
          <div className="table-editor-warn">
            <p>No table payload is available in {previewSourceLabel} yet.</p>
          </div>
        ) : null}
      </section>

      <section className="table-editor-panel table-editor-panel--flat">
        <div className="table-editor-section-header">
          <div>
            <h2>Rendered output</h2>
            <p className="muted">A lightweight renderer for checking the saved table output.</p>
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
