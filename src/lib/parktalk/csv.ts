function escape(value: string) {
  const v = value ?? "";
  // Neutralise spreadsheet formulas and quote every cell.
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Builds a UTF-8 CSV (with BOM so Excel shows Thai correctly) and downloads it. */
export function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
