"use client";

import { useState } from "react";

export default function UnitSearchBar({
  onSearch,
}: {
  onSearch?: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  function handleChange(v: string) {
    setValue(v);
    onSearch?.(v);
  }

  function clear() {
    setValue("");
    onSearch?.("");
  }

  return (
    <div className="sticky top-0 z-10 bg-white border-b p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search unit number..."
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />

        {value && (
          <button
            onClick={clear}
            className="text-sm px-3 py-2 border rounded"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}