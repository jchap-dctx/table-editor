export type ParsedCsvResult = {
  matrix: string[][];
  errors: string[];
};

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === "\"") {
      const next = line[i + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseCsvText(text: string): ParsedCsvResult {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "")
    .map(splitCsvLine);

  if (rows.length === 0) {
    return {
      matrix: [],
      errors: ["CSV file is empty."],
    };
  }

  return {
    matrix: rows,
    errors: [],
  };
}

export async function parseCsvFile(file: File): Promise<ParsedCsvResult> {
  try {
    const text = await file.text();
    return parseCsvText(text);
  } catch {
    return {
      matrix: [],
      errors: ["Unable to read CSV file."],
    };
  }
}
