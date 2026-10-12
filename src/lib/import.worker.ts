/// <reference lib="webworker" />
import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { Sheet } from "./import";
function sheet(name: string, matrix: string[][], warnings: string[]): Sheet {
  const nonempty = matrix.filter((r) => r.some((v) => v.trim()));
  const [headers = [], ...rows] = nonempty;
  if (!headers.length || !rows.length)
    throw new Error("Arket måste innehålla en rubrikrad och minst en datarad.");
  if (rows.length > 50000)
    throw new Error("Högst 50 000 rader per import. Dela upp filen.");
  return {
    name,
    headers: headers.map((h, i) => h.trim() || `Kolumn ${i + 1}`),
    rows,
    warnings,
  };
}
self.onmessage = async (
  e: MessageEvent<{ buffer: ArrayBuffer; filename: string }>,
) => {
  try {
    const { buffer, filename } = e.data;
    const warnings: string[] = [];
    let sheets: Sheet[];
    if (filename.toLowerCase().endsWith(".csv")) {
      let text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("\ufffd")) {
        text = new TextDecoder("windows-1252").decode(buffer);
        warnings.push(
          "Filen lästes som Windows-1252 för att bevara svenska tecken. Kontrollera förhandsvisningen.",
        );
      }
      const parsed = Papa.parse<string[]>(text.replace(/^\ufeff/, ""), {
        skipEmptyLines: "greedy",
        dynamicTyping: false,
      });
      if (parsed.errors.some((e) => e.type === "Quotes"))
        throw new Error(
          "Felaktiga citationstecken i CSV-filen. Kontrollera filen och försök igen.",
        );
      sheets = [sheet(filename, parsed.data, warnings)];
    } else {
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(buffer);
      sheets = [];
      book.eachSheet((ws) => {
        if (ws.actualRowCount > 50001)
          throw new Error(
            `Bladet ${ws.name} har fler än 50 000 datarader. Dela upp filen.`,
          );
        const matrix: string[][] = [];
        const wsWarnings: string[] = [];
        ws.eachRow((row) => {
          const values: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell, col) => {
            if (cell.type === ExcelJS.ValueType.Formula) {
              values[col - 1] = "";
              if (
                !wsWarnings.includes(
                  "Formelceller ignorerades. Använd fasta värden för företag och kontaktuppgifter.",
                )
              )
                wsWarnings.push(
                  "Formelceller ignorerades. Använd fasta värden för företag och kontaktuppgifter.",
                );
            } else if (cell.type === ExcelJS.ValueType.Number) {
              const format = cell.numFmt;
              const value = String(cell.value ?? "");
              values[col - 1] = /^0+$/.test(format)
                ? value.padStart(format.length, "0")
                : value;
              if (
                !wsWarnings.includes(
                  "Numeriska telefonceller kan ha förlorat inledande nollor i Excel. Kontrollera telefonkolumnen.",
                )
              )
                wsWarnings.push(
                  "Numeriska telefonceller kan ha förlorat inledande nollor i Excel. Kontrollera telefonkolumnen.",
                );
            } else values[col - 1] = cell.text || "";
          });
          matrix.push(
            Array.from(
              { length: Math.max(values.length, ws.columnCount) },
              (_, i) => values[i] ?? "",
            ),
          );
        });
        if (matrix.filter((r) => r.some((v) => v.trim())).length > 1)
          sheets.push(sheet(ws.name, matrix, wsWarnings));
      });
      if (!sheets.length)
        throw new Error(
          "Inget kalkylblad med rubriker och datarader hittades.",
        );
    }
    self.postMessage({ sheets });
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
