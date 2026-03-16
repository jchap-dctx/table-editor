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
  const displayElementCodenames = useMemo(
    () =>
      [
        config.titleElementCodename,
        config.captionElementCodename,
        config.variantElementCodename,
        config.pageSizeElementCodename,
        config.emptyStateElementCodename,
        config.ctaLabelElementCodename,
        config.ctaLinkElementCodename,
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
  const title = getTextValue(
    config.titleElementCodename ? watchedElements?.get(config.titleElementCodename) : null,
  );
  const caption = getTextValue(
    config.captionElementCodename ? watchedElements?.get(config.captionElementCodename) : null,
  );
  const variant = getTextValue(
    config.variantElementCodename ? watchedElements?.get(config.variantElementCodename) : null,
  );
  const pageSize = getNumberValue(
    config.pageSizeElementCodename ? watchedElements?.get(config.pageSizeElementCodename) : null,
  );
  const emptyStateMessage =
    getTextValue(
      config.emptyStateElementCodename ? watchedElements?.get(config.emptyStateElementCodename) : null,
    ) || "No data available for this table.";
  const ctaLabel = getTextValue(
    config.ctaLabelElementCodename ? watchedElements?.get(config.ctaLabelElementCodename) : null,
  );
  const ctaLink = getTextValue(
    config.ctaLinkElementCodename ? watchedElements?.get(config.ctaLinkElementCodename) : null,
  );
  const variantClassName = getVariantClass(variant || "full");
  const condensedCount = pageSize ?? 10;
  const previewRows =
    variantClassName === "is-condensed" ? payload.rows.slice(0, condensedCount) : payload.rows;

  return (
    <div className="table-editor-root table-editor-preview-page">
      {parsed.warnings.length > 0 ? (
        <div className="table-editor-warn table-editor-status">
          {parsed.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      {sourceElementCodenames.length === 0 ? (
        <div className="table-editor-warn table-editor-status">
          <p>
            Add <code>sourceElementCodename</code> in this custom element&apos;s JSON parameters to point at
            the inline table field you want to preview.
          </p>
        </div>
      ) : null}
      {payload.columns.length === 0 && parsed.warnings.length === 0 ? (
        <div className="table-editor-warn table-editor-status">
          <p>No table payload is available in the linked inline table field yet.</p>
        </div>
      ) : null}
      <section className={`table-editor-module-preview ${variantClassName}`}>
        <div className="table-editor-module-frame">
          {title || caption ? (
            <div className="table-editor-module-header">
              {title ? <h3>{title}</h3> : null}
              {caption ? <p className="table-editor-module-caption">{caption}</p> : null}
            </div>
          ) : null}
          {payload.columns.length > 0 ? (
            <>
              {variantClassName === "is-full" ? (
                <div className="table-editor-module-controls" aria-hidden="true">
                  <div className="table-editor-module-search">Search</div>
                  <div className="table-editor-module-filter">Class</div>
                  <div className="table-editor-module-filter">Week</div>
                </div>
              ) : null}
              <div className="table-editor-module-rule" aria-hidden="true" />
            </>
          ) : null}
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
