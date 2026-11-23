"use client";

import { type ReactNode, useMemo, useState } from "react";

export interface Column<T> {
  id: string;
  header: string;
  /** Present → header is a sort button. */
  sort?: (row: T) => number | string | bigint;
  align?: "num";
  cell: (row: T) => ReactNode;
}

type Dir = "asc" | "desc";

/** Native <table>; sortable headers are buttons with aria-sort. Sorts only the rows passed in. */
export function SortableTable<T>({ caption, columns, rows, rowKey, testId, rowTestId, initial }: {
  caption: string; columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; testId: string; rowTestId: string; initial?: { id: string; dir: Dir };
}) {
  const [sort, setSort] = useState<{ id: string; dir: Dir } | null>(initial ?? null);
  const sorted = useMemo(() => {
    const col = sort ? columns.find((c) => c.id === sort.id) : undefined;
    if (!sort || !col?.sort) return rows;
    const f = col.sort;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = f(a), y = f(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sign;
    });
  }, [rows, sort, columns]);

  return (
    <div className="overflow-x-auto">
      <table className="data stack" data-testid={testId}>
        <caption>{caption}{sort ? " · sorted within loaded rows" : ""}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.id} scope="col" className={c.align === "num" ? "num" : undefined}
                aria-sort={sort?.id === c.id ? (sort.dir === "asc" ? "ascending" : "descending") : c.sort ? "none" : undefined}>
                {c.sort ? (
                  <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-ink-2"
                    onClick={() => setSort((s) => (s?.id === c.id ? { id: c.id, dir: s.dir === "asc" ? "desc" : "asc" } : { id: c.id, dir: "desc" }))}>
                    {c.header}<span aria-hidden="true">{sort?.id === c.id ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}</span>
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)} data-testid={rowTestId}>
              {columns.map((c) => (
                <td key={c.id} data-label={c.header} className={c.align === "num" ? "num" : undefined}>{c.cell(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
