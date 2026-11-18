import { invoke } from "@tauri-apps/api/core";
import { homeDir, join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";

export async function getCliPath(): Promise<string | null> {
  return await invoke<string | null>("get_cli_path");
}

export async function writeFileAtomic(
  path: string,
  contents: string,
): Promise<void> {
  await invoke<string | null>("write_file_atomic", { path, contents });
}

export async function readFile(path: string): Promise<string | null> {
  return await invoke<string | null>("read_file", { path });
}

export async function resolvePath(p: string): Promise<string> {
  const t = p.trim();
  if (t === "~") return await homeDir();
  if (t.startsWith("~/")) return await join(await homeDir(), t.slice(2));
  return t;
}

export async function closeApp() {
  await getCurrentWindow().close();
}
