import { NextResponse } from "next/server";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { listSyncRuns } from "@/lib/db/preferences";

export async function GET() {
  try {
    const user = await requireApiUser();
    const runs = await listSyncRuns(user.id);
    return NextResponse.json({ runs });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to load sync history" }, { status: 500 });
  }
}
