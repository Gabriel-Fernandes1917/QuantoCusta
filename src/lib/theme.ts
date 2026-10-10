export const THEME_STORAGE_KEY = "coyler:theme:v1";
export type ThemePreference = "light" | "dark" | "system";

// Self-contained: serialized into a small script that runs before the body paints.
function bootstrapTheme(key: string) {
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  function apply(value: string | null) {
    const preference = value === "light" || value === "dark" ? value : "system";
    root.dataset.themePreference = preference;
    root.dataset.theme = preference === "system" ? system.matches ? "dark" : "light" : preference;
    window.dispatchEvent(new Event("coyler:theme-change"));
  }
  try { apply(window.localStorage.getItem(key)); } catch { apply(null); }
  system.addEventListener("change", () => {
    if (root.dataset.themePreference === "system") apply("system");
  });
  window.addEventListener("storage", event => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
}

export const THEME_INIT_SCRIPT = `(${bootstrapTheme.toString()})(${JSON.stringify(THEME_STORAGE_KEY)});`;

export function themePreference(): ThemePreference {
  const value = document.documentElement.dataset.themePreference;
  return value === "light" || value === "dark" ? value : "system";
}
export function subscribeTheme(listener: () => void) {
  window.addEventListener("coyler:theme-change", listener);
  return () => window.removeEventListener("coyler:theme-change", listener);
}
export function selectTheme(preference: ThemePreference): boolean {
  let saved = true;
  try { window.localStorage.setItem(THEME_STORAGE_KEY, preference); } catch { saved = false; }
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = preference === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : preference;
  window.dispatchEvent(new Event("coyler:theme-change"));
  return saved;
}
