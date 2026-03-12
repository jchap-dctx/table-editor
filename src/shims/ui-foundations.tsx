import type { CSSProperties, FC } from "react";

export const ICONS = {
  search: true,
  add: true,
  close: true,
  check: true,
  chevron_down: true,
  info: true,
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  style?: CSSProperties;
};

export const Icon: FC<IconProps> = ({ name, size = 20, style }) => {
  const glyphs: Record<IconName, string> = {
    search: "S",
    add: "+",
    close: "x",
    check: "v",
    chevron_down: "v",
    info: "i",
  };

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(12, Math.round(size * 0.7)),
        lineHeight: 1,
        ...style,
      }}
      title={name}
    >
      {glyphs[name] ?? "o"}
    </span>
  );
};
