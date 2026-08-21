import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, requireApiUser } from "@/lib/api-auth";
import { getUserPreferences, upsertUserPreferences } from "@/lib/db/preferences";

export async function GET() {
  try {
    const user = await requireApiUser();
    const preferences = await getUserPreferences(user.id);
    return NextResponse.json({ preferences });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const body = (await request.json()) as {
      autoSync?: boolean;
      initialized?: boolean;
      useDemoEvents?: boolean;
    };

    const preferences = await upsertUserPreferences(user.id, body);
    return NextResponse.json({ preferences });
  } catch (error) {
    if (isNextResponse(error)) {
      return error;
    }
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
