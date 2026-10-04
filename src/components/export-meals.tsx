"use client";
import { useRef, useState } from "react";
import type { MealResult } from "@/lib/calculations/meal-comparison";
import { downloadBlob } from "@/lib/export/download";
import { reportFilename, type ReportBrand } from "@/lib/export/report";
export function ExportMeals({ result, brand }: { result: MealResult; brand: ReportBrand }) {
  const [busy, setBusy] = useState<string | null>(null), [notice, setNotice] = useState(""); const lock = useRef(false);
  async function download(kind: "pdf" | "xlsx") {
    if (lock.current) return; lock.current = true; setBusy(kind); setNotice("");
    try {
      const { createMealPdf, createMealExcel } = await import("@/lib/export/meal-comparison");
      const options = { brand, generatedAt: new Date() };
      const blob = kind === "pdf" ? new Blob([Uint8Array.from(await createMealPdf(result, options)).buffer], { type: "application/pdf" }) : await createMealExcel(result, options);
      downloadBlob(blob, reportFilename(options.generatedAt, kind).replace("planejamento", "comer-fora-ou-cozinhar")); setNotice("Relatório gerado. Confira os downloads do navegador.");
    } catch { setNotice("Não foi possível gerar o relatório. Seus valores foram mantidos; tente novamente."); }
    finally { lock.current = false; setBusy(null); }
  }
  return <section className="export-panel" aria-busy={busy !== null}><h3>Leve sua comparação com você</h3><p>PDF com a comparação da rotina e Excel com resumo, refeições, detalhamento e premissas.</p><div className="export-actions">{(["pdf", "xlsx"] as const).map(kind => <button type="button" className="secondary-button" key={kind} disabled={busy !== null} onClick={() => download(kind)}>{busy === kind ? "Gerando…" : kind === "pdf" ? "Baixar PDF" : "Baixar Excel"}</button>)}</div><p className="field-hint">Arquivos gerados no dispositivo. O Excel contém números editáveis, sem recálculo automático dos totais.</p><p role="status" className="calculator-notice">{notice}</p></section>;
}
