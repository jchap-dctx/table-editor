export type Config = Readonly<{
  title?: string;
  caption?: string;
  variant?: string;
  pageSize?: number | string;
  emptyStateMessage?: string;
  ctaLabel?: string;
  ctaLink?: string;
  textElementCodename?: string;
  sourceElementCodename?: string;
  sourceElementCodenames?: ReadonlyArray<string> | string;
  sourceCodename?: string;
  elementCodename?: string;
  titleElementCodename?: string;
  captionElementCodename?: string;
  variantElementCodename?: string;
  pageSizeElementCodename?: string;
  emptyStateElementCodename?: string;
  ctaLabelElementCodename?: string;
  ctaLinkElementCodename?: string;
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
