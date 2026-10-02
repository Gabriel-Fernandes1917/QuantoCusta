"use client";

import { useRef, useState } from "react";
import type { CostOfLivingResult } from "@/lib/calculations/cost-of-living";
import { downloadBlob } from "@/lib/export/download";
import { reportFilename, type ReportBrand } from "@/lib/export/report";

export function ExportPlanning({ result, brand }: { result: CostOfLivingResult; brand: ReportBrand }) {
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const [notice, setNotice] = useState("");
  const exporting = useRef(false);

  async function exportFile(kind: "pdf" | "xlsx") {
    if (exporting.current) return;
    exporting.current = true;
    setBusy(kind);
    setNotice("");
    const options = { brand, generatedAt: new Date() };
    try {
      let blob: Blob;
      if (kind === "pdf") {
        const { createPlanningPdf } = await import("@/lib/export/pdf");
        const bytes = await createPlanningPdf(result, options);
        blob = new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" });
      } else {
        const { createPlanningExcel } = await import("@/lib/export/excel");
        blob = await createPlanningExcel(result, options);
      }
      downloadBlob(blob, reportFilename(options.generatedAt, kind));
      setNotice("Arquivo gerado. Se o download não aparecer, verifique as permissões de download do navegador.");
    } catch {
      setNotice("Não foi possível gerar o arquivo. Seus valores foram mantidos; tente baixar novamente.");
    } finally {
      exporting.current = false;
      setBusy(null);
    }
  }

  return <section className="export-panel" aria-labelledby="export-title" aria-busy={busy !== null}>
    <h3 id="export-title">Leve seu planejamento com você</h3>
    <p>Baixe em segundos um resumo organizado dos valores que você informou.</p>
    <div className="export-actions"><button type="button" className="secondary-button" disabled={busy !== null} onClick={() => exportFile("pdf")}>{busy === "pdf" ? "Gerando PDF…" : "Baixar PDF"}</button><button type="button" className="secondary-button" disabled={busy !== null} onClick={() => exportFile("xlsx")}>{busy === "xlsx" ? "Gerando Excel…" : "Baixar Excel"}</button></div>
    <p className="field-hint">Os arquivos são gerados no seu dispositivo. Seus valores financeiros não são enviados para nossos servidores.</p>
    <p className="field-hint">O Excel contém valores editáveis, sem atualização automática dos totais após a edição.</p>
    <p className="calculator-notice" role="status">{notice}</p>
  </section>;
}
