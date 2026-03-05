export type Value = string;

export const parseValue = (
  input: string | null,
): Value | null | "invalidValue" => {
  if (input === null) {
    return null;
  }

  return input;
};
