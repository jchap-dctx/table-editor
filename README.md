# TableBlock Prototype

Prototype React app that demonstrates a `TableBlock` workflow for a sports media site:

- Inline mode for spreadsheet-style authoring
- Dataset mode for large, paginated tables
- One shared frontend `DataTable` renderer used by both modes

## Run

```bash
npm install
npm run dev
```

Build for a production-like check:

```bash
npm run build
```

## What the prototype demonstrates

- Editors can add, remove, reorder, and configure columns in an inline authoring UI.
- Editors can add and remove rows, edit cells directly, and paste tabular data copied from Google Sheets or Excel.
- Pasted data treats the first row as headers, infers column keys, and does simple text/number type inference.
- Inline authoring surfaces validation errors and guardrails when a table exceeds 150 rows or 20 columns.
- The same `DataTable` component renders both inline-authored data and dataset-backed data.
- Dataset mode simulates `GET /api/table?datasetKey=...&page=...&pageSize=...&sortBy=...&sortDirection=...&search=...`.
- Dataset mode demonstrates loading, empty, error, sorting, search, pagination, horizontal scroll, sticky headers, and pinned columns.

## Project structure

- [`src/App.tsx`](/Users/jchap/Repos/codex/dctx/src/App.tsx): top-level mode switch, layout, and dataset orchestration
- [`src/components/TableEditor.tsx`](/Users/jchap/Repos/codex/dctx/src/components/TableEditor.tsx): inline spreadsheet-like authoring UI
- [`src/components/DataTable.tsx`](/Users/jchap/Repos/codex/dctx/src/components/DataTable.tsx): shared TanStack table renderer
- [`src/services/mockDatasetService.ts`](/Users/jchap/Repos/codex/dctx/src/services/mockDatasetService.ts): async mock dataset fetch service
- [`src/data/mockDatasets.ts`](/Users/jchap/Repos/codex/dctx/src/data/mockDatasets.ts): example sports datasets
- [`src/utils/tableUtils.ts`](/Users/jchap/Repos/codex/dctx/src/utils/tableUtils.ts): contract defaults, paste parsing, validation, and normalization

## Intentional non-goals

- Authentication
- Backend persistence
- CMS integration
- Production styling or accessibility polish
- Advanced filtering
- Grouping, expandable rows, virtualization, exports, or CSV import

## Notes

- `PapaParse` is wired into the paste-import path so CSV import can be added later without changing the core parsing approach.
- Local component state is used intentionally to keep the prototype readable and easy to review with product and engineering teams.
