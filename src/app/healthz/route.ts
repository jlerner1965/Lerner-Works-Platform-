import { NextResponse } from "next/server";
import { withAnon } from "@/server/data/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await withAnon((db) => db`select 1`);
    return NextResponse.json({ ok: true, database: "reachable" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
