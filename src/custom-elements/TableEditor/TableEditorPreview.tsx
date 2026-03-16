import { useEffect, useMemo, useRef, useState } from "react";
import { useConfig, useItemInfo, useValue, useVariantInfo } from "../../context";
import { useElements } from "../../helpers/selectors";
import {
  buildPayloadFromGrid,
  createEmptyPayload,
  getTableEditorDraftStorageKey,
  parseStoredPayload,
} from "./helpers";
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

function firstDefined(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim());
}

export function TableEditorPreview() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const config = useConfig();
  const [storedValue] = useValue();
  const item = useItemInfo();
  const variantInfo = useVariantInfo();
  const [draftFallbackValue, setDraftFallbackValue] = useState<string | null>(null);
  const storageKey = useMemo(
    () => getTableEditorDraftStorageKey(item.id, variantInfo.codename),
    [item.id, variantInfo.codename],
  );
  const sourceElementCodenames = useMemo(() => {
    const fromConfig = [
      firstDefined(
        config.sourceElementCodename,
        config.sourceCodename,
        config.elementCodename,
        config.textElementCodename,
        "table_editor",
      ),
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
  const previewSourceValue = watchedValue ?? draftFallbackValue ?? storedValue;
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

  useEffect(() => {
    const serializedDraft = window.localStorage.getItem(storageKey);
    if (!serializedDraft) {
      setDraftFallbackValue(null);
      return;
    }

    try {
      const draft = JSON.parse(serializedDraft) as {
        payload?: InlineTablePayloadV1;
        lastImportStatus?: "idle" | "success" | "too-large";
      };

      if (draft.lastImportStatus === "too-large") {
        setDraftFallbackValue(null);
        return;
      }

      setDraftFallbackValue(draft.payload ? JSON.stringify(draft.payload) : null);
    } catch (error) {
      console.warn("Unable to restore preview draft state.", error);
      setDraftFallbackValue(null);
    }
  }, [storageKey, watchedValue]);

  useEffect(() => {
    const nextHeight = rootRef.current?.getBoundingClientRect().height;
    if (!nextHeight) {
      return;
    }

    CustomElement.setHeight(Math.ceil(nextHeight + 24));
  }, [payload]);

  const hasRows = payload.columns.length > 0 && payload.rows.length > 0;

  return (
    <div className="table-editor-root table-editor-preview-page" ref={rootRef}>
      {hasRows ? (
        <section className="table-editor-inline-preview">
          <div className="table-editor-rendered-preview">
            <table className="table-editor-preview-table table-editor-rendered-table">
              <colgroup>
                {payload.columns.map((column) => (
                  <col key={`preview-col-${column.key}`} style={getColumnWidthStyle(column)} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {payload.columns.map((column) => (
                    <th
                      key={`preview-head-${column.key}`}
                      style={{ ...getColumnWidthStyle(column), textAlign: column.align }}
                    >
                      <span className="table-editor-rendered-head-label">{column.label}</span>
                      <span className="table-editor-rendered-head-meta">{column.type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.rows.map((row) => (
                  <tr key={`preview-row-${row.id}`}>
                    {payload.columns.map((column) => (
                      <td
                        key={`preview-${row.id}-${column.key}`}
                        style={{ ...getColumnWidthStyle(column), textAlign: column.align }}
                      >
                        <div className="table-editor-rendered-cell">
                          <span className="table-editor-rendered-cell-primary">
                            {formatPreviewCell(column, row[column.key])}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="table-editor-empty-preview-message">
          No inline table payload is available to preview.
        </div>
      )}
    </div>
  );
}
