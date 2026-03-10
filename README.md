# TableBlock Prototype

> **This repository contains a prototype and is not production implementation.**

This project is a team-shareable prototype for validating the TableBlock product direction for a sports media platform.  
It demonstrates how editors can author tables quickly in inline mode, how larger tables can run in dataset mode, and how both paths use one shared frontend renderer.

## Project overview

The app contains three connected areas:

- **Table Editor**: spreadsheet-like inline authoring for editorial workflows.
- **Table Renderer**: one reusable `DataTable` component for rendering.
- **Dataset Mode Simulation**: a mock API-style service for scalable table data.

At runtime, the user switches between **Inline Mode** and **Dataset Mode**, and both modes flow through the same table renderer.

## What this prototype demonstrates

- Inline table authoring with add/remove/reorder columns, row editing, and paste from Sheets/Excel.
- Column-level configuration for label, key, type, sorting/searching flags, visibility, pinning, alignment, and mobile priority.
- Validation and inline guardrails:
  - Unique column keys.
  - Numeric validation for number columns.
  - Warning guidance when tables exceed inline-friendly size.
- Dataset-backed rendering using simulated query parameters (`datasetKey`, `page`, `sortBy`, `sortDirection`, `search`).
- Shared rendering behaviors in one component:
  - Sorting.
  - Pagination.
  - Sticky header.
  - Horizontal scroll.
  - Pinned columns.
  - Loading/empty/error states.
- Guided demo UX for quick internal review:
  - Intro context panel.
  - A short "How to use this prototype" walkthrough.
  - Quick actions to load representative inline/dataset demo states.

## Suggested review flow (2-3 minutes)

1. Open the landing/intro content for context on Inline vs Dataset mode.
2. In Inline mode, paste or edit a table in the editor panel.
3. Review the shared DataTable preview behavior.
4. Inspect the JSON payload/debug panel.
5. Use quick actions or mode switch to Dataset mode.
6. Load Program Rankings or Roster and validate shared rendering behavior at larger scale.

## Screenshots

Add screenshots under `docs/screenshots/` and keep these filenames for consistent sharing:

- `docs/screenshots/inline-mode-editor.png` (Inline editor with live preview)
- `docs/screenshots/dataset-mode.png` (Dataset selector + paginated renderer)
- `docs/screenshots/json-debug-panel.png` (Canonical JSON payload inspector)

Markdown placeholders:

```md
![Inline mode editor](docs/screenshots/inline-mode-editor.png)
![Dataset mode](docs/screenshots/dataset-mode.png)
![JSON payload inspector](docs/screenshots/json-debug-panel.png)
```

## Tech stack

- React
- TypeScript
- Vite
- TanStack Table (`@tanstack/react-table`) for shared table rendering logic
- PapaParse for spreadsheet-like paste parsing
- Plain CSS for prototype UI

## JSON contract

The prototype uses a canonical `TableContract` shape in [`src/types/table.ts`](/Users/jchap/Repos/codex/dctx/src/types/table.ts).  
This is the handoff boundary between authoring/data source concerns and rendering concerns.

Core contract ideas:

- `sourceType`: `"inline"` or `"dataset"`.
- `columns`: canonical `TableColumn[]` metadata used by the renderer.
- `rows`: inline row data when `sourceType = "inline"`.
- `dataset`: dataset config when `sourceType = "dataset"`.
- `display`: renderer behavior flags (`variant`, pagination, sorting, sticky header, horizontal scroll, pinned mobile columns).

## TanStack usage

The shared renderer lives in [`src/components/DataTable.tsx`](/Users/jchap/Repos/codex/dctx/src/components/DataTable.tsx) and uses TanStack Table for:

- Column definitions generated from the canonical contract.
- Local sorting/pagination in inline mode.
- Manual sorting/pagination hooks in dataset mode.
- Column pinning state (including mobile-priority pinned columns).

This keeps rendering logic centralized while allowing different data-source strategies.

## Repository structure

- [`src/App.tsx`](/Users/jchap/Repos/codex/dctx/src/App.tsx): mode switching and orchestration
- [`src/components/TableEditor.tsx`](/Users/jchap/Repos/codex/dctx/src/components/TableEditor.tsx): inline authoring experience
- [`src/components/DataTable.tsx`](/Users/jchap/Repos/codex/dctx/src/components/DataTable.tsx): shared renderer (Inline + Dataset)
- [`src/services/mockDatasetService.ts`](/Users/jchap/Repos/codex/dctx/src/services/mockDatasetService.ts): mock async dataset API behavior
- [`src/data/mockDatasets.ts`](/Users/jchap/Repos/codex/dctx/src/data/mockDatasets.ts): sample datasets
- [`src/utils/tableUtils.ts`](/Users/jchap/Repos/codex/dctx/src/utils/tableUtils.ts): parsing, validation, defaults, normalization
- [`docs/screenshots/.gitkeep`](/Users/jchap/Repos/codex/dctx/docs/screenshots/.gitkeep): screenshot placeholder folder for team sharing

## Setup instructions

### Prerequisites

- Node.js 20+ (tested with Node.js 22)
- npm 10+

### Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Then open the local Vite URL shown in terminal (typically `http://localhost:5173`).

Optional verification build:

```bash
npm run build
```

## Deployment

This prototype is deployable as a static frontend on Vercel.

### Vercel (recommended)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Vercel, click **Add New Project** and import the repository.
3. Vercel will detect the included [`vercel.json`](/Users/jchap/Repos/codex/dctx/vercel.json) and use:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Click **Deploy**.

No environment variables are required for this prototype.

### Local parity check before deploy

```bash
npm install
npm run build
npm run dev
```

### Why this works on Vercel

- The app is a Vite SPA that compiles to static assets in `dist/`.
- Dataset behavior is mocked in frontend code (no backend runtime required).
- There are no server-side dependencies (Express/Fastify/Node server runtime) required for deployment.

## Out of scope (intentional)

- Authentication and authorization
- Backend persistence or production API integration
- CMS integration and publishing workflows
- Production-grade styling/accessibility hardening
- CSV upload/import UI (paste is intentionally the MVP ingestion path)
- Advanced filtering
- Grouping, expandable rows, virtualization, export

## Relation to the future TableBlock feature

This prototype is a behavior-validation artifact, not the final implementation.  
It is intended to de-risk future TableBlock development by validating:

- Authoring ergonomics in inline mode.
- Scale handoff to dataset mode.
- A stable contract and shared renderer strategy that can plug into a future CMS + backend stack.

In a production implementation, the same contract/renderer approach can be retained while replacing local state and mock services with persistent backend-backed workflows.
