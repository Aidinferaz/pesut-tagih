export const THEME_STORAGE_KEY = "pesut-theme";
export type ThemeChoice = "light" | "dark" | "system";

/**
 * Runs before first paint so a stored light/dark choice never flashes.
 * "system" leaves <html> without data-theme and lets CSS follow the OS.
 * Keep this string stable: its hash is allowed in the CSP.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
