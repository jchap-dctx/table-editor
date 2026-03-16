import { useEffect, useMemo, useRef } from "react";
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

function getTextValue(value: string | ReadonlyArray<MultiChoiceOption> | null | undefined): string {
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value[0]?.codename ?? value[0]?.name ?? "";
  }

  return String(value);
}

function getNumberValue(value: string | ReadonlyArray<MultiChoiceOption> | null | undefined): number | null {
  const text = getTextValue(value);
  if (!text) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getVariantClass(variant: string): string {
  const normalized = variant.trim().toLowerCase();
  return normalized === "condensed" ? "is-condensed" : "is-full";
}

function firstDefined(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim());
}

export function TableEditorPreview() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const config = useConfig();
  const [storedValue] = useValue();
  const sourceElementCodenames = useMemo(() => {
    const fromConfig = [
      firstDefined(config.sourceElementCodename, config.sourceCodename, config.elementCodename, config.textElementCodename, "table_editor"),
      ...(Array.isArray(config.sourceElementCodenames)
        ? config.sourceElementCodenames
        : typeof config.sourceElementCodenames === "string"
          ? config.sourceElementCodenames.split(",")
          : []),
    ];

    return fromConfig.map((value) => value?.trim()).filter(Boolean) as string[];
  }, [config]);
  const displayElementCodenames = useMemo(
    () =>
      [
        firstDefined(config.titleElementCodename, "title"),
        firstDefined(config.captionElementCodename, "caption"),
        firstDefined(config.variantElementCodename, "variant"),
        firstDefined(config.pageSizeElementCodename, "page_size"),
        firstDefined(config.emptyStateElementCodename, "empty_state_message"),
        firstDefined(config.ctaLabelElementCodename, "cta_label"),
        firstDefined(config.ctaLinkElementCodename, "cta_link"),
      ]
        .map((value) => value?.trim())
        .filter(Boolean) as string[],
    [config],
  );
  const watchedElements = useElements([...sourceElementCodenames, ...displayElementCodenames]);
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
  const titleCodename = firstDefined(config.titleElementCodename, "title");
  const captionCodename = firstDefined(config.captionElementCodename, "caption");
  const variantCodename = firstDefined(config.variantElementCodename, "variant");
  const pageSizeCodename = firstDefined(config.pageSizeElementCodename, "page_size");
  const emptyStateCodename = firstDefined(config.emptyStateElementCodename, "empty_state_message");
  const ctaLabelCodename = firstDefined(config.ctaLabelElementCodename, "cta_label");
  const ctaLinkCodename = firstDefined(config.ctaLinkElementCodename, "cta_link");
  const title = getTextValue(titleCodename ? watchedElements?.get(titleCodename) : null);
  const caption = getTextValue(captionCodename ? watchedElements?.get(captionCodename) : null);
  const variant = getTextValue(variantCodename ? watchedElements?.get(variantCodename) : null);
  const pageSize = getNumberValue(pageSizeCodename ? watchedElements?.get(pageSizeCodename) : null);
  const emptyStateMessage =
    getTextValue(emptyStateCodename ? watchedElements?.get(emptyStateCodename) : null) ||
    "No data available for this table.";
  const ctaLabel = getTextValue(ctaLabelCodename ? watchedElements?.get(ctaLabelCodename) : null);
  const ctaLink = getTextValue(ctaLinkCodename ? watchedElements?.get(ctaLinkCodename) : null);
  const variantClassName = getVariantClass(variant || "full");
  const previewRows = pageSize ? payload.rows.slice(0, pageSize) : payload.rows;

  useEffect(() => {
    const nextHeight = rootRef.current?.getBoundingClientRect().height;
    if (!nextHeight) {
      return;
    }

    CustomElement.setHeight(Math.ceil(nextHeight + 24));
  }, [caption, ctaLabel, emptyStateMessage, pageSize, payload, title, variantClassName, watchedElements]);

  return (
    <div className="table-editor-root table-editor-preview-page" ref={rootRef}>
      <section className={`table-editor-module-preview ${variantClassName}`}>
        <div className="table-editor-module-frame">
          {title || caption ? (
            <div className="table-editor-module-header">
              {title ? <h3>{title}</h3> : null}
              {caption ? <p className="table-editor-module-caption">{caption}</p> : null}
            </div>
          ) : null}
          {payload.columns.length > 0 ? <div className="table-editor-module-rule" aria-hidden="true" /> : null}
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
                    <th
                      key={`harness-head-${column.key}`}
                      style={{ ...getColumnWidthStyle(column), textAlign: column.align }}
                    >
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
                      {emptyStateMessage}
                    </td>
                  </tr>
                ) : (
                  previewRows.map((row) => (
                    <tr key={`harness-row-${row.id}`}>
                      {payload.columns.map((column) => (
                        <td
                          key={`harness-${row.id}-${column.key}`}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
          {ctaLabel ? (
            <div className="table-editor-module-footer">
              <a
                className="table-editor-cta-button"
                href={ctaLink || undefined}
                target={ctaLink ? "_blank" : undefined}
                rel={ctaLink ? "noreferrer" : undefined}
                aria-disabled={!ctaLink}
                onClick={(event) => {
                  if (!ctaLink) {
                    event.preventDefault();
                  }
                }}
              >
                {ctaLabel}
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
