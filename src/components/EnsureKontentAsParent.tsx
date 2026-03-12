import type { FC, ReactElement } from "react";

type Props = Readonly<{
  children: ReactElement | null;
}>;

export const EnsureKontentAsParent: FC<Props> = (props) => {
  const isEmbeddedInKontent = window !== window.top;
  const isLocalDevPreviewEnabled =
    import.meta.env.DEV &&
    (new URLSearchParams(window.location.search).get("localPreview") === "1" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (!isEmbeddedInKontent && !isLocalDevPreviewEnabled) {
    return (
      <h1 style={{ lineHeight: 1.5 }}>
        This can only be rendered as a custom element in the Kontent.ai app. See{" "}
        <a href={helpLink} target="_blank" rel="noreferrer">
          the documentation
        </a>{" "}
        for more information.
      </h1>
    );
  }

  return props.children;
};

EnsureKontentAsParent.displayName = "EnsureKontentAsParent";

const helpLink =
  "https://kontent.ai/learn/tutorials/develop-apps/integrate/content-editing-extensions/#a-add-the-custom-element-to-your-project";
