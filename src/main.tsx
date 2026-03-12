import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "@kontent-ai/stylekit";
import { EnsureKontentAsParent } from "./components";
import { CustomElementContext } from "./context";

const ensureLocalDevCustomElementMock = () => {
  const isLocalPreview =
    import.meta.env.DEV &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      new URLSearchParams(window.location.search).get("localPreview") === "1");

  if (!isLocalPreview || "CustomElement" in globalThis) {
    return;
  }

  let currentValue: string | null = null;
  const itemObserverCallbacks: Array<(newItemDetails: ItemChangedDetails) => void> = [];
  const disabledCallbacks: Array<(isDisabled: boolean) => void> = [];
  const elementChangeCallbacks: Array<
    (changedElementCodenames: ReadonlyArray<string>) => void
  > = [];

  const context: Context = {
    projectId: "local-dev-project",
    item: {
      id: "local-dev-item",
      codename: "local_dev_item",
      name: "Local Dev Item",
      collection: { id: "local-dev-collection" },
    },
    variant: {
      id: "local-dev-variant",
      codename: "default",
    },
  };

  (globalThis as unknown as { CustomElement: typeof CustomElement }).CustomElement = {
    init: (callback) => {
      callback(
        {
          config: {},
          disabled: false,
          value: currentValue,
        },
        context,
      );
    },
    setValue: (newValue) => {
      currentValue =
        typeof newValue === "object" && newValue !== null && "value" in newValue
          ? newValue.value
          : newValue;
      elementChangeCallbacks.forEach((cb) => cb(["table_editor"]));
    },
    onDisabledChanged: (callback) => {
      disabledCallbacks.push(callback);
      callback(false);
    },
    setHeight: () => {},
    getElementValue: (_elementCodename, callback) => {
      callback(currentValue ?? "");
    },
    observeElementChanges: (_elementCodenames, callback) => {
      elementChangeCallbacks.push(callback);
    },
    observeItemChanges: (callback) => {
      itemObserverCallbacks.push(callback);
      callback({
        name: context.item.name,
        codename: context.item.codename,
        collection: context.item.collection,
      });
    },
    selectAssets: async () => null,
    getAssetDetails: async () => null,
    selectItems: async () => null,
    getItemDetails: async () => null,
  };
};

ensureLocalDevCustomElementMock();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EnsureKontentAsParent>
      <CustomElementContext height="dynamic">
        <BrowserRouter basename="/custom-elements">
          <App />
        </BrowserRouter>
      </CustomElementContext>
    </EnsureKontentAsParent>
  </StrictMode>,
);
