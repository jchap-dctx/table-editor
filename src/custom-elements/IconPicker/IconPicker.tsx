import type React from "react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Icon, ICONS } from "@dctx/ui-foundations";
import type { IconName } from "@dctx/ui-foundations";
import { useIsDisabled, useValue } from "../../context";

const allIconNames = Object.keys(ICONS) as IconName[];

export const IconPicker: React.FC = () => {
  const [value, setValue] = useValue();
  const isDisabled = useIsDisabled();
  const [query, setQuery] = useState(value ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const selected = value ? (value as IconName) : null;
  const [hasUserTyped, setHasUserTyped] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredIcons = useMemo(() => {
    if (isOpen && !hasUserTyped) {
      return allIconNames;
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return allIconNames;
    }

    return allIconNames.filter((name) =>
      name.toLowerCase().includes(normalized),
    );
  }, [hasUserTyped, isOpen, query]);

  useLayoutEffect(() => {
    const newSize = Math.max(document.documentElement.offsetHeight, 50);
    CustomElement.setHeight(Math.ceil(newSize));
  }, [filteredIcons.length, isOpen]);

  const closeOptions = useCallback(() => {
    setIsOpen(false);
    setHasUserTyped(false);
    setQuery((prev) => (prev.trim() === "" && selected ? selected : prev));
  }, [selected]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeOptions();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [closeOptions]);

  const handleSelect = (name: IconName) => {
    setQuery(name);
    setHasUserTyped(false);
    setIsOpen(false);
    setValue(name);
  };

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setQuery("");
    setHasUserTyped(false);
    setIsOpen(false);
    setValue("");
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        maxWidth: "420px",
        position: "relative",
        fontFamily: "inherit",
        fontSize: "14px",
        fontWeight: 400,
        lineHeight: "18px",
      }}
    >
      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        onKeyDown={(event) => {
          if (isDisabled) return;
          if (event.target === inputRef.current) return;
          if (event.key === "Enter" || event.key === " ") {
            if (!isOpen) {
              setIsOpen(true);
            }
            setHasUserTyped(false);
          }
        }}
        className={`select ${isOpen ? "open" : ""} ${isDisabled ? "disabled" : ""}`}
        onClick={(event) => {
          if (isDisabled) {
            return;
          }
          if (event.target === inputRef.current) {
            if (!isOpen) {
              setIsOpen(true);
              setHasUserTyped(false);
            }
            return;
          }

          if (!isOpen) {
            setIsOpen(true);
          }
          setHasUserTyped(false);
        }}
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "8px",
          width: "unset",
        }}
      >
        {selected ? <Icon name={selected} size={24} /> : null}
        <input
          id="icon-picker-search"
          type="text"
          value={query}
          placeholder="Select an icon..."
          ref={inputRef}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            setHasUserTyped(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setHasUserTyped(false);
            if (value && !hasUserTyped) {
              setQuery(value);
            }
          }}
          onBlur={() => {
            if (query.trim() === "" && selected) {
              setQuery(selected);
            }
          }}
          style={{
            border: "none",
            outline: "none",
            flex: 1,
            fontSize: "14px",
            backgroundColor: "transparent",
          }}
        />
        {selected ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear selection"
            style={{
              border: "none",
              background: "transparent",
              color: "#64748b",
              cursor: "pointer",
              padding: "4px 6px",
            }}
          >
            Clear
          </button>
        ) : null}
      </div>
      {isOpen ? (
        <div
          role="listbox"
          className="options"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            width: "100%",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        >
          {filteredIcons.length === 0 ? (
            <div style={{ padding: "12px 16px", color: "#64748b" }}>
              No results
            </div>
          ) : (
            filteredIcons.map((name) => (
              <div
                key={name}
                role="option"
                aria-selected={selected === name}
                onClick={() => handleSelect(name)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(name);
                  }
                }}
                className={`option ${selected === name ? "selected" : ""}`}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <Icon name={name} size={24} />
                <span>{name}</span>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

IconPicker.displayName = "IconPicker";
