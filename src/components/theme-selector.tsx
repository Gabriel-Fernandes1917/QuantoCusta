"use client";

import { useState, useSyncExternalStore } from "react";
import { selectTheme, subscribeTheme, themePreference, type ThemePreference } from "@/lib/theme";

const serverPreference = (): ThemePreference => "system";
export function ThemeSelector() {
  const preference = useSyncExternalStore(subscribeTheme, themePreference, serverPreference);
  const [notice, setNotice] = useState("");
  return <div className="theme-control">
    <label htmlFor="site-theme">Tema</label>
    <select id="site-theme" value={preference} aria-describedby={notice ? "theme-notice" : undefined} onChange={event => {
      const saved = selectTheme(event.target.value as ThemePreference);
      setNotice(saved ? "" : "Tema aplicado nesta visita. O navegador não permitiu salvar a preferência.");
    }}>
      <option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Automático</option>
    </select>
    <span id="theme-notice" className="sr-only" role="status">{notice}</span>
  </div>;
}
