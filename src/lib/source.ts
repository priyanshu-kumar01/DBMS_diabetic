import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/** Folders/files that make up the React + FastAPI + MySQL deliverable. */
export const SOURCE_ROOTS = ["README.md", "database", "python_backend", "react_frontend"];
const SKIP = new Set(["node_modules", "dist", "__pycache__", ".venv", ".env"]);

export interface SourceFile {
  path: string;
  size: number;
}

async function walk(abs: string, rel: string, out: SourceFile[]): Promise<void> {
  const s = await stat(abs);
  if (s.isDirectory()) {
    for (const name of (await readdir(abs)).sort()) {
      if (SKIP.has(name)) continue;
      await walk(path.join(abs, name), `${rel}/${name}`, out);
    }
  } else {
    out.push({ path: rel, size: s.size });
  }
}

export async function listSourceFiles(): Promise<SourceFile[]> {
  const out: SourceFile[] = [];
  for (const root of SOURCE_ROOTS) {
    try {
      await walk(path.join(/*turbopackIgnore: true*/ process.cwd(), root), root, out);
    } catch {
      /* folder missing – skip */
    }
  }
  return out;
}

export function isAllowedSourcePath(rel: string): boolean {
  const norm = path.posix.normalize(rel.replace(/\\/g, "/"));
  if (norm.startsWith("..") || norm.startsWith("/")) return false;
  if (norm.split("/").some((seg) => SKIP.has(seg))) return false;
  return SOURCE_ROOTS.some((r) => norm === r || norm.startsWith(`${r}/`));
}

export async function readSourceFile(rel: string): Promise<string> {
  return readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), rel), "utf8");
}
