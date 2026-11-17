import { invoke } from "@tauri-apps/api/core";

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
