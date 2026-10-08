"use client";
import { useRef, useState } from "react";
import type { TripResult } from "@/lib/calculations/trip-cost";
import { downloadBlob } from "@/lib/export/download";
import { reportFilename, type ReportBrand } from "@/lib/export/report";
export function ExportTrip({ result, brand }: { result: TripResult; brand: ReportBrand }) {
  const [busy,setBusy]=useState<string|null>(null),[notice,setNotice]=useState("");const lock=useRef(false);
  async function download(kind:"pdf"|"xlsx"){
    if(lock.current)return;lock.current=true;setBusy(kind);setNotice("");
    try{const {createTripPdf,createTripExcel}=await import("@/lib/export/trip-cost");const options={brand,generatedAt:new Date()};const blob=kind==="pdf"?new Blob([Uint8Array.from(await createTripPdf(result,options)).buffer],{type:"application/pdf"}):await createTripExcel(result,options);downloadBlob(blob,reportFilename(options.generatedAt,kind).replace("planejamento","custo-da-viagem"));setNotice("Relatório gerado. Confira os downloads do navegador.");}
    catch{setNotice("Não foi possível gerar o relatório. Seus valores foram mantidos; tente novamente.");}
    finally{lock.current=false;setBusy(null);}
  }
  return <section className="export-panel" aria-busy={busy!==null}><h3>Leve seu planejamento com você</h3><p>PDF com resumo, despesas, comparação e premissas; Excel com valores numéricos editáveis.</p><div className="export-actions">{(["pdf","xlsx"] as const).map(kind=><button type="button" className="secondary-button" key={kind} disabled={busy!==null} onClick={()=>download(kind)}>{busy===kind?"Gerando…":kind==="pdf"?"Baixar relatório em PDF":"Baixar Excel"}</button>)}</div><p className="field-hint">Arquivos gerados no dispositivo. O Excel é um retrato da simulação: editar valores não recalcula os totais.</p><p role="status" className="calculator-notice">{notice}</p></section>;
}
