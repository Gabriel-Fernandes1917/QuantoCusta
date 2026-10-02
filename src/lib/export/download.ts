export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Dá tempo para o navegador iniciar o download, inclusive em dispositivos móveis.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
