"use client";

import { useState } from "react";

const email = "gabgui2001@gmail.com";
const suggestion = `Olá!

Gostaria de sugerir uma ferramenta para a Coyler.

Minha ideia:

[Descreva sua sugestão aqui]

Qual decisão essa ferramenta ajudaria a tomar?

[Conte um pouco sobre a situação]`;
const problem = `Olá!

Encontrei um possível problema na Coyler.

Ferramenta ou página:

[Informe aqui]

O que aconteceu?

[Descreva o problema]

O que você esperava que acontecesse?

[Descreva aqui]`;

function mailto(subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;
}

export function HomeFeedback() {
  const [status, setStatus] = useState("");
  async function copyEmail() {
    setStatus("");
    try {
      await navigator.clipboard.writeText(email);
      setStatus("E-mail copiado.");
    } catch {
      setStatus("Não foi possível copiar. Selecione o endereço acima e copie manualmente.");
    }
  }
  return <section id="feedback" className="container feedback-section" aria-labelledby="feedback-title">
    <p className="eyebrow">Vamos construir os próximos passos</p>
    <h2 id="feedback-title">Ajude a melhorar a Coyler.</h2>
    <p className="feedback-description">Sentiu falta de alguma ferramenta ou encontrou algo que não funcionou como esperado? Sua sugestão pode ajudar a melhorar o site.</p>
    <div className="feedback-grid">
      <article><h3>Tem uma ideia de ferramenta?</h3><p>Conte qual decisão você gostaria de comparar ou planejar.</p><a className="text-link" href={mailto("[Coyler] Sugestão de ferramenta", suggestion)} target="_blank" rel="noopener noreferrer">Sugerir ferramenta →</a></article>
      <article><h3>Encontrou algum problema?</h3><p>Avise se algum cálculo, resultado ou funcionalidade não funcionou como esperado.</p><a className="text-link" href={mailto("[Coyler] Relato de problema", problem)} target="_blank" rel="noopener noreferrer">Relatar problema →</a></article>
    </div>
    <p className="feedback-note">Ao clicar, seu aplicativo de e-mail será aberto com uma mensagem pronta para você revisar e enviar.</p>
    <div className="feedback-copy"><p>Prefere copiar o endereço? <span>{email}</span></p><button type="button" onClick={copyEmail}>Copiar e-mail</button></div>
    <p className="feedback-status" role="status">{status}</p>
  </section>;
}
