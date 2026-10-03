import JSZip from "jszip";
import { listSourceFiles, readSourceFile } from "@/lib/source";

export const dynamic = "force-dynamic";

/** GET /api/source/download – zip of React front-end + FastAPI backend + SQL scripts */
export async function GET() {
  const zip = new JSZip();
  const root = zip.folder("diabetes-dbms-project")!;
  for (const f of await listSourceFiles()) {
    root.file(f.path, await readSourceFile(f.path));
  }
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="diabetes-dbms-react-fastapi-mysql.zip"',
      "Cache-Control": "no-store",
    },
  });
}
