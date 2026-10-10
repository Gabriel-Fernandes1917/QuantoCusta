import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { selectTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "../src/lib/theme";

function environment(saved: string | null, dark: boolean, blocked = false) {
  const dataset: Record<string, string> = {};
  const systemListeners: Array<() => void> = [];
  const storageListeners: Array<(event: { key: string | null; newValue: string | null }) => void> = [];
  const system = { matches: dark, addEventListener: (_: string, listener: () => void) => systemListeners.push(listener) };
  const storage = { getItem: vi.fn(() => { if (blocked) throw new Error("SecurityError"); return saved; }), setItem: vi.fn(() => { if (blocked) throw new Error("SecurityError"); }) };
  const document = { documentElement: { dataset } };
  const window = {
    localStorage: storage, matchMedia: vi.fn(() => system), dispatchEvent: vi.fn(),
    addEventListener: (_: string, listener: typeof storageListeners[number]) => storageListeners.push(listener),
  };
  runInNewContext(THEME_INIT_SCRIPT, { document, window, Event });
  return { dataset, document, window, storage, system,
    systemChange(value: boolean) { system.matches = value; systemListeners.forEach(fn => fn()); },
    storageChange(key: string | null, newValue: string | null) { storageListeners.forEach(fn => fn({ key, newValue })); },
  };
}

describe("temas antes da renderização", () => {
  it.each([true, false])("primeira visita segue o sistema (%s) sem escrita automática", dark => {
    const env = environment(null, dark);
    expect(env.dataset).toEqual({ themePreference: "system", theme: dark ? "dark" : "light" });
    expect(env.storage.setItem).not.toHaveBeenCalled();
    expect(env.storage.getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
  });
  it.each(["light", "dark"])("preferência %s salva prevalece e não acompanha o sistema", saved => {
    const env = environment(saved, saved !== "dark"); env.systemChange(saved === "dark");
    expect(env.dataset.theme).toBe(saved); expect(env.dataset.themePreference).toBe(saved);
  });
  it("automático reage a alterações do sistema", () => {
    const env = environment("system", false); env.systemChange(true);
    expect(env.dataset.theme).toBe("dark"); env.systemChange(false); expect(env.dataset.theme).toBe("light");
  });
  it.each(["corrompido", "<script>"])("preferência inválida %s volta ao automático", saved => {
    expect(environment(saved, true).dataset.themePreference).toBe("system");
  });
  it("armazenamento bloqueado mantém tema do sistema e script funcional", () => {
    expect(environment(null, true, true).dataset.theme).toBe("dark");
  });
  it("sincroniza tema entre abas sem responder a alterações de simulações", () => {
    const env = environment("dark", false);
    env.storageChange("quantocusta:trip-cost:v1", null); expect(env.dataset.theme).toBe("dark");
    env.storageChange(THEME_STORAGE_KEY, "light"); expect(env.dataset.theme).toBe("light");
    env.storageChange(null, null); expect(env.dataset.themePreference).toBe("system");
  });
  it.each([false, true])("seleção manual atualiza a aparência mesmo com armazenamento bloqueado (%s)", blocked => {
    const env = environment(null, false, blocked);
    vi.stubGlobal("window", env.window); vi.stubGlobal("document", env.document);
    try {
      expect(selectTheme("dark")).toBe(!blocked);
      expect(env.dataset.theme).toBe("dark");
      expect(env.storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, "dark");
      expect(selectTheme("system")).toBe(!blocked);
      env.systemChange(true); expect(env.dataset.theme).toBe("dark");
    } finally { vi.unstubAllGlobals(); }
  });
});
