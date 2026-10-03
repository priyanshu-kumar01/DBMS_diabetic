import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-helpers";
import { isAllowedSourcePath, listSourceFiles, readSourceFile } from "@/lib/source";

export const dynamic = "force-dynamic";

/** GET /api/source            – list of deliverable files
 *  GET /api/source?file=path  – content of one file */
export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  if (file) {
    if (!isAllowedSourcePath(file)) return fail("File not allowed", 403);
    try {
      return ok({ file, content: await readSourceFile(file) });
    } catch {
      return fail("File not found", 404);
    }
  }
  return ok({ files: await listSourceFiles() });
}
