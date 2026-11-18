export function parse(params: any) {
  const raw: string = (params.argString ?? "").trim();
  return {
    force: raw.startsWith("!"),
    arg: raw.replace(/^!/, "").trim() || undefined,
  };
}
