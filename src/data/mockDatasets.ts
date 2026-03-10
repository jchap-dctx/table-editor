import type { TableColumn, TableRow } from "../types/table";
import { createColumn } from "../utils/tableUtils";

export type DatasetDefinition = {
  datasetKey: string;
  label: string;
  description: string;
  columns: TableColumn[];
  rows: TableRow[];
};

function buildRows<T extends Record<string, string | number>>(items: T[]): TableRow[] {
  return items.map((item, index) => ({
    id: `${index + 1}`,
    ...item,
  }));
}

const programRankingColumns: TableColumn[] = [
  { ...createColumn("Rank", "rank", "number"), pinned: true, mobilePriority: 1 },
  { ...createColumn("School", "school"), pinned: true, mobilePriority: 1 },
  { ...createColumn("Classification", "classification"), mobilePriority: 2 },
  { ...createColumn("Record", "record"), mobilePriority: 2 },
  { ...createColumn("Points", "points", "number"), align: "right", mobilePriority: 3 },
];

const rosterColumns: TableColumn[] = [
  { ...createColumn("Number", "number", "number"), pinned: true, mobilePriority: 1 },
  { ...createColumn("Player", "player"), pinned: true, mobilePriority: 1 },
  { ...createColumn("Position", "position"), mobilePriority: 2 },
  { ...createColumn("Class", "class"), mobilePriority: 3 },
  { ...createColumn("Height", "height"), mobilePriority: 4 },
  { ...createColumn("Weight", "weight", "number"), align: "right", mobilePriority: 4 },
];

const statsColumns: TableColumn[] = [
  { ...createColumn("Player", "player"), pinned: true, mobilePriority: 1 },
  { ...createColumn("Team", "team"), pinned: true, mobilePriority: 1 },
  { ...createColumn("Passing Yards", "passingYards", "number"), align: "right", mobilePriority: 2 },
  { ...createColumn("Touchdowns", "touchdowns", "number"), align: "right", mobilePriority: 2 },
  { ...createColumn("Interceptions", "interceptions", "number"), align: "right", mobilePriority: 2 },
];

const schools = [
  "North City",
  "Lakeview Prep",
  "Metro Academy",
  "Cedar Grove",
  "River State",
  "Pioneer Central",
  "East Ridge",
  "Oak Valley",
  "Summit Union",
  "Westbrook",
  "Capital Tech",
  "Briarfield",
];

const classes = ["5A", "5A", "4A", "4A", "3A", "3A", "2A"];
const positions = ["QB", "RB", "WR", "TE", "LB", "CB", "S", "DL"];
const academicClasses = ["FR", "SO", "JR", "SR"];
const teams = ["Storm", "Hawks", "Wildcats", "Bulls", "Panthers", "Titans", "Wolves"];

export const datasetDefinitions: DatasetDefinition[] = [
  {
    datasetKey: "program-rankings",
    label: "Program Rankings",
    description: "Rankings table with pinned rank and school columns.",
    columns: programRankingColumns,
    rows: buildRows(
      Array.from({ length: 72 }, (_, index) => ({
        rank: index + 1,
        school: `${schools[index % schools.length]} ${index > schools.length ? "HS" : ""}`.trim(),
        classification: classes[index % classes.length],
        record: `${26 - (index % 6)}-${2 + (index % 5)}`,
        points: 100 - index,
      })),
    ),
  },
  {
    datasetKey: "roster",
    label: "Roster",
    description: "Player roster table with enough rows to exercise pagination.",
    columns: rosterColumns,
    rows: buildRows(
      Array.from({ length: 58 }, (_, index) => ({
        number: index + 1,
        player: `Player ${index + 1}`,
        position: positions[index % positions.length],
        class: academicClasses[index % academicClasses.length],
        height: `${5 + ((index + 2) % 2)}-${6 + (index % 7)}`,
        weight: 175 + ((index * 7) % 65),
      })),
    ),
  },
  {
    datasetKey: "stats",
    label: "Stats",
    description: "Passing leaders dataset with server-like sorting and search.",
    columns: statsColumns,
    rows: buildRows(
      Array.from({ length: 96 }, (_, index) => ({
        player: `Quarterback ${index + 1}`,
        team: teams[index % teams.length],
        passingYards: 1850 + index * 41,
        touchdowns: 12 + (index % 24),
        interceptions: 3 + (index % 8),
      })),
    ),
  },
];

export function getDatasetDefinition(datasetKey: string): DatasetDefinition | undefined {
  return datasetDefinitions.find((dataset) => dataset.datasetKey === datasetKey);
}
