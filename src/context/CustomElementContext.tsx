import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
} from "react";
import type { ReactNode } from "react";
import { type Config, isConfig } from "../helpers/config";
import { type Value, parseValue } from "../helpers/parseValue";

// hooks are only ever used in the react tree so this is fine
/* eslint-disable react-refresh/only-export-components */
export const useConfig = () => useContext(Context).config;

export const useValue = () =>
  [useContext(Context).value, useContext(Context).setValue] as const;

export const useIsDisabled = () => useContext(Context).isDisabled;

export const useEnvironmentId = () => useContext(Context).environmentId;

export const useItemInfo = () => useContext(Context).item;

export const useVariantInfo = () => useContext(Context).variant;
/* eslint-enable react-refresh/only-export-components */

type CustomElementContext = Readonly<{
  config: Config;
  value: Value | null;
  setValue: (newValue: Value | null) => void;
  isDisabled: boolean;
  environmentId: string;
  item: ItemInfo;
  variant: Readonly<{
    id: string;
    codename: string;
  }>;
}>;

type ItemInfo = Readonly<{
  id: string;
}> &
  ItemChangedDetails;

type CustomElementContextProps = Readonly<{
  height?: number | "default" | "dynamic";
  children: ReactNode;
}>;

export const CustomElementContext = (props: CustomElementContextProps) => {
  type State = {
    isDisabled: boolean;
    value: Value | null | typeof specialMissingValue;
    config: Config | typeof specialMissingValue;
    error: string | null;
    environmentId: string | null;
    item: ItemInfo | null;
    variant:
      | Readonly<{
          id: string;
          codename: string;
        }>
      | null;
  };

  type Action =
    | { type: "INIT"; payload: Partial<State> }
    | { type: "SET_VALUE"; payload: Value | null }
    | { type: "SET_IS_DISABLED"; payload: boolean }
    | { type: "SET_CONFIG"; payload: Config }
    | { type: "SET_ERROR"; payload: string | null }
    | { type: "SET_ENVIRONMENT_ID"; payload: string }
    | { type: "SET_ITEM_UPDATE"; payload: Partial<ItemChangedDetails> }
    | { type: "SET_VARIANT"; payload: State["variant"] };

  const initialState: State = {
    isDisabled: false,
    value: specialMissingValue,
    config: specialMissingValue,
    error: null,
    environmentId: null,
    item: null,
    variant: null,
  };

  function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "INIT":
        return { ...state, ...action.payload };
      case "SET_VALUE":
        return { ...state, value: action.payload };
      case "SET_IS_DISABLED":
        return { ...state, isDisabled: action.payload };
      case "SET_CONFIG":
        return { ...state, config: action.payload };
      case "SET_ERROR":
        return { ...state, error: action.payload };
      case "SET_ENVIRONMENT_ID":
        return { ...state, environmentId: action.payload };
      case "SET_ITEM_UPDATE":
        return { ...state, item: state.item ? { ...state.item, ...action.payload } : state.item };
      case "SET_VARIANT":
        return { ...state, variant: action.payload };
      default:
        return state;
    }
  }

  const [state, dispatch] = useReducer(reducer, initialState);

  const context = useMemo(() => {
    if (
      state.config === specialMissingValue ||
      state.value === specialMissingValue ||
      !state.environmentId ||
      !state.item ||
      !state.variant
    ) {
      return null;
    }
    return {
      config: state.config as Config,
      value: state.value as Value | null,
      setValue: (newValue: Value | null) => {
        CustomElement.setValue(newValue);
        dispatch({ type: "SET_VALUE", payload: newValue });
      },
      isDisabled: state.isDisabled,
      environmentId: state.environmentId,
      item: state.item,
      variant: state.variant,
    };
  }, [state]);

  useEffect(() => {
    CustomElement.init((element, context) => {
      const normalizedConfig = element.config ?? {};
      if (!isConfig(normalizedConfig)) {
        dispatch({ type: "SET_ERROR", payload: "The element's config is not valid!" });
        return;
      }
      const parsedValue = parseValue(element.value);
      if (parsedValue === "invalidValue") {
        console.warn(
          `Custom element received invalid value "${element.value}". Treating it as a missing value.`,
        );
      }

      dispatch({
        type: "INIT",
        payload: {
          value: parsedValue === "invalidValue" ? null : parsedValue,
          config: normalizedConfig as Config,
          isDisabled: element.disabled,
          environmentId: context.projectId,
          item: context.item,
          variant: context.variant,
        },
      });
    });
  }, []);

  useEffect(() => {
    CustomElement.observeItemChanges((i) =>
      dispatch({ type: "SET_ITEM_UPDATE", payload: i }),
    );
  }, []);

  useEffect(() => {
    CustomElement.onDisabledChanged((d: boolean) => dispatch({ type: "SET_IS_DISABLED", payload: d }));
  }, []);

  useDynamicHeight(props.height === "dynamic", state.value);

  useEffect(() => {
    if (typeof props.height === "number") {
      CustomElement.setHeight(props.height);
    }
  }, [props.height]);

  if (state.error) {
    return <h1 style={{ color: "red" }}>{state.error}</h1>;
  }

  if (!context) {
    return <h1>Loading...</h1>;
  }

  return <Context.Provider value={context}>{props.children}</Context.Provider>;
};

const Context = React.createContext<CustomElementContext>({
  value: null,
  variant: { id: "", codename: "" },
  item: {
    id: "",
    codename: "",
    name: "",
    collection: { id: "" },
  },
  environmentId: "",
  config: {} as Config,
  isDisabled: true,
  setValue: () => {},
});

const useDynamicHeight = (
  isEnabled: boolean,
  value: Value | null | typeof specialMissingValue,
) => {
  useLayoutEffect(() => {
    if (!isEnabled) {
      return;
    }
    const newSize = Math.max(document.documentElement.offsetHeight, 100);

    CustomElement.setHeight(Math.ceil(newSize));
  }, [value, isEnabled]); // recalculate the size when value changes
};

const specialMissingValue =
  "This value is special and indicates that a value is missing. This allows having undefined and null as valid values." as const;
