import { useEffect, useRef, useState, type JSX } from "react";

interface DropdownProps {
  trigger: React.ReactNode;
  items: string[];
  onSelect: (item: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
  header?: React.ReactNode;
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  open,
  onOpenChange,
  placeholder,
  header,
}: DropdownProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  // Reset highlight when open state changes
  useEffect(() => {
    setHighlightIndex(-1);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, onOpenChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < items.length - 1 ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = highlightIndex >= 0 ? highlightIndex : 0;
      if (items[idx] !== undefined) {
        onSelect(items[idx]);
        onOpenChange(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onKeyDown={handleKeyDown}
    >
      {trigger}
      {open && (
        <ul className="absolute z-50 mt-1 w-max min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-md max-h-48 overflow-y-auto">
          {header && (
            <li className="px-2 py-1 border-b border-gray-100 dark:border-gray-700">{header}</li>
          )}
          {items.length === 0 && placeholder ? (
            <li className="px-3 py-1.5 text-sm text-gray-400 dark:text-gray-500 italic">
              {placeholder}
            </li>
          ) : (
            items.map((item, i) => (
              <li
                key={i}
                className={`px-3 py-1.5 cursor-pointer text-sm text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 ${
                  i === highlightIndex ? "bg-blue-100 dark:bg-blue-900/60" : ""
                }`}
                onMouseDown={(e) => {
                  // Use mousedown to fire before blur events
                  e.preventDefault();
                  onSelect(item);
                  onOpenChange(false);
                }}
              >
                {item}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
