"use client";
import { useRef, useState } from "react";
import type { ComparisonResult } from "@/lib/calculations/property-comparison";
import { downloadBlob } from "@/lib/export/download";
import { reportFilename, type ReportBrand } from "@/lib/export/report";
export function ExportComparison({ result, brand }: { result: ComparisonResult; brand: ReportBrand }) {
  const [busy, setBusy] = useState<string | null>(null), [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function download(kind: "pdf" | "xlsx") {
    if (lock.current) return; lock.current = true; setBusy(kind); setNotice("");
    try {
      const { createComparisonPdf, createComparisonExcel } = await import("@/lib/export/property-comparison");
      const options = { brand, generatedAt: new Date() };
      const blob = kind === "pdf" ? new Blob([Uint8Array.from(await createComparisonPdf(result, options)).buffer], { type: "application/pdf" }) : await createComparisonExcel(result, options);
      downloadBlob(blob, reportFilename(options.generatedAt, kind).replace("planejamento", "comparacao-imoveis")); setNotice("Relatório gerado. Confira os downloads do navegador.");
    } catch { setNotice("Não foi possível gerar o relatório. Seus valores foram mantidos; tente novamente."); }
    finally { lock.current = false; setBusy(null); }
  }
  return <section className="export-panel" aria-busy={busy !== null}><h3>Leve a comparação com você</h3><p>PDF para compartilhar e Excel com resumo, detalhamento e premissas.</p><div className="export-actions">{(["pdf", "xlsx"] as const).map(kind => <button type="button" className="secondary-button" key={kind} disabled={busy !== null} onClick={() => download(kind)}>{busy === kind ? "Gerando…" : kind === "pdf" ? "Baixar PDF" : "Baixar Excel"}</button>)}</div><p className="field-hint">Arquivos gerados no dispositivo. O Excel contém números editáveis, sem recálculo automático dos totais.</p><p role="status" className="calculator-notice">{notice}</p></section>;
}
