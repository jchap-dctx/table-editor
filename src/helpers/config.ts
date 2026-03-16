export type Config = Readonly<{
  textElementCodename?: string;
  sourceElementCodename?: string;
  sourceElementCodenames?: ReadonlyArray<string> | string;
  sourceCodename?: string;
  elementCodename?: string;
}>;

export const isConfig = (
  value: Readonly<Record<string, unknown>> | null,
): value is Readonly<Record<string, unknown>> => {
  if (value === null) {
    return false;
  }

  if (typeof value !== "object") {
    return false;
  }

  return true;
};
