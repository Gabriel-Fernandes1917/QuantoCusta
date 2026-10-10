import type { Cell, Sheet } from "write-excel-file/universal";

// Presentation only: keep values, formulas, formats and merged cells intact.
export function styleExcelSheets(sheets: Sheet<Blob>[]): Sheet<Blob>[] {
  return sheets.map(sheet => {
    let stripe = 0;
    return {
      ...sheet,
      stickyRowsCount: 1,
      data: sheet.data.map(row => {
        const blank = row.every(cell => cell == null);
        if (blank) { stripe = 0; return row; }
        const heading = row.some(cell => cell && typeof cell === "object" && "fontWeight" in cell && cell.fontWeight === "bold");
        const backgroundColor = heading || stripe++ % 2 === 0 ? "#FFFFFF" : "#F5F6F7";
        if (heading) stripe = 0;
        return row.map((cell): Cell => {
          const original = cell != null && typeof cell === "object" && !(cell instanceof Date) ? cell : { value: cell ?? undefined };
          return {
            borderStyle: "thin", borderColor: "#DCE1E5",
            backgroundColor, wrap: true, alignVertical: "center",
            ...("value" in original && typeof original.value === "number" ? { align: "right" as const } : {}),
            ...original,
            ...(heading ? { height: Math.max("height" in original ? original.height ?? 0 : 0, 42) } : {}),
          };
        });
      }),
    };
  });
}
