import { useEffect, useState } from "react";
import { DataTable } from "./components/DataTable";
import { JsonPanel } from "./components/JsonPanel";
import { TableEditor } from "./components/TableEditor";
import { datasetDefinitions, getDatasetDefinition } from "./data/mockDatasets";
import { fetchDatasetPage } from "./services/mockDatasetService";
import type { DatasetResponse, TableContract } from "./types/table";
import { buildDefaultInlineContract, getDefaultDisplayConfig } from "./utils/tableUtils";

type Mode = "inline" | "dataset";

function buildDatasetContract(datasetKey: string, response?: DatasetResponse): TableContract {
  const definition = getDatasetDefinition(datasetKey);
  const columns = response?.columns ?? definition?.columns ?? [];

  return {
    version: 1,
    tableId: `${datasetKey}-dataset-demo`,
    title: definition?.label || "Dataset table",
    caption: definition?.description || "Dataset-backed table rendered through the shared frontend component.",
    sourceType: "dataset",
    columns,
    dataset: {
      datasetKey,
      defaultSort: {
        sortBy: columns[0]?.key ?? "rank",
        sortDirection: "asc",
      },
      searchPlaceholder: `Search ${definition?.label || "dataset"}`,
      columnsSource: "dataset",
      allowCmsColumnOverrides: true,
    },
    display: {
      ...getDefaultDisplayConfig(),
      variant: datasetKey === "roster" ? "condensed" : "full",
      mobilePinnedColumns: datasetKey === "program-rankings" ? ["rank", "school"] : columns.slice(0, 2).map((column) => column.key),
    },
    metadata: {
      prototype: true,
    },
  };
}

export default function App() {
  const [mode, setMode] = useState<Mode>("inline");
  const [inlineDraft, setInlineDraft] = useState<TableContract>(() => buildDefaultInlineContract());
  const [savedInlineContract, setSavedInlineContract] = useState<TableContract>(() => buildDefaultInlineContract());
  const [datasetKey, setDatasetKey] = useState<string>(datasetDefinitions[0].datasetKey);
  const [datasetResponse, setDatasetResponse] = useState<DatasetResponse | undefined>(undefined);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [datasetPage, setDatasetPage] = useState(1);
  const [datasetSortBy, setDatasetSortBy] = useState<string | undefined>(undefined);
  const [datasetSortDirection, setDatasetSortDirection] = useState<"asc" | "desc" | undefined>(undefined);
  const [datasetSearch, setDatasetSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDataset() {
      setDatasetLoading(true);
      setDatasetError(null);

      try {
        const response = await fetchDatasetPage({
          datasetKey,
          page: datasetPage,
          pageSize: 10,
          sortBy: datasetSortBy,
          sortDirection: datasetSortDirection,
          search: datasetSearch,
        });
        if (!cancelled) {
          setDatasetResponse(response);
        }
      } catch (error) {
        if (!cancelled) {
          setDatasetError(error instanceof Error ? error.message : "Failed to load dataset.");
          setDatasetResponse(undefined);
        }
      } finally {
        if (!cancelled) {
          setDatasetLoading(false);
        }
      }
    }

    loadDataset();
    return () => {
      cancelled = true;
    };
  }, [datasetKey, datasetPage, datasetSearch, datasetSortBy, datasetSortDirection]);

  const datasetContract = buildDatasetContract(datasetKey, datasetResponse);
  const debugPayload =
    mode === "inline"
      ? savedInlineContract
      : {
          contract: datasetContract,
          response: datasetResponse,
        };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Prototype</p>
          <h1>TableBlock workflow for a sports media site</h1>
          <p className="hero-copy">
            Editors can author a table inline, switch to dataset-backed rendering for scale, and send both flows through
            the same shared `DataTable` renderer.
          </p>
        </div>
        <div className="mode-switch" role="tablist" aria-label="Mode switch">
          <button type="button" className={mode === "inline" ? "active" : ""} onClick={() => setMode("inline")}>
            Inline Mode
          </button>
          <button type="button" className={mode === "dataset" ? "active" : ""} onClick={() => setMode("dataset")}>
            Dataset Mode
          </button>
        </div>
      </header>

      <main className="workspace">
        <div className="workspace-grid">
          {mode === "inline" ? (
            <TableEditor
              contract={inlineDraft}
              onChange={setInlineDraft}
              onSave={(contract) => {
                setSavedInlineContract(contract);
                setInlineDraft(contract);
              }}
            />
          ) : (
            <section className="panel editor-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Dataset Mode Simulation</p>
                  <h2>Mock API-backed table</h2>
                  <p className="muted">
                    The dataset selector drives async fetches, server-style pagination, optional search, and remote sorting.
                  </p>
                </div>
              </div>
              <div className="stack">
                <div className="field-grid two-up">
                  <label>
                    <span>Dataset</span>
                    <select
                      value={datasetKey}
                      onChange={(event) => {
                        setDatasetKey(event.target.value);
                        setDatasetPage(1);
                        setDatasetSortBy(undefined);
                        setDatasetSortDirection(undefined);
                        setDatasetSearch("");
                      }}
                    >
                      {datasetDefinitions.map((dataset) => (
                        <option key={dataset.datasetKey} value={dataset.datasetKey}>
                          {dataset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Dataset key</span>
                    <input value={datasetKey} readOnly />
                  </label>
                </div>
                <div className="info-card">
                  <strong>{getDatasetDefinition(datasetKey)?.label}</strong>
                  <p>{getDatasetDefinition(datasetKey)?.description}</p>
                  <p className="muted">
                    Simulated API route:
                    <code>
                      /api/table?datasetKey={datasetKey}&page={datasetPage}&pageSize=10&sortBy=
                      {datasetSortBy || "none"}&sortDirection={datasetSortDirection || "none"}&search=
                      {datasetSearch || "none"}
                    </code>
                  </p>
                </div>
                <div className="field-grid three-up">
                  <label>
                    <span>Page size</span>
                    <input value={10} readOnly />
                  </label>
                  <label>
                    <span>Current page</span>
                    <input value={datasetPage} readOnly />
                  </label>
                  <label>
                    <span>Search support</span>
                    <input value="Enabled for prototype" readOnly />
                  </label>
                </div>
              </div>
            </section>
          )}

          <DataTable
            contract={mode === "inline" ? inlineDraft : datasetContract}
            rows={mode === "dataset" ? datasetResponse?.rows : undefined}
            loading={mode === "dataset" ? datasetLoading : false}
            error={mode === "dataset" ? datasetError : null}
            manualPagination={mode === "dataset"}
            totalPages={datasetResponse?.totalPages}
            totalRowCount={datasetResponse?.totalRowCount}
            page={mode === "dataset" ? datasetPage : undefined}
            onPageChange={mode === "dataset" ? setDatasetPage : undefined}
            onSortingChange={
              mode === "dataset"
                ? (sortBy, sortDirection) => {
                    setDatasetSortBy(sortBy);
                    setDatasetSortDirection(sortDirection);
                    setDatasetPage(1);
                  }
                : undefined
            }
            searchValue={mode === "dataset" ? datasetSearch : ""}
            onSearchChange={mode === "dataset" ? setDatasetSearch : undefined}
          />
        </div>

        <JsonPanel title="Canonical payload inspector" value={debugPayload} />
      </main>
    </div>
  );
}
