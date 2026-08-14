import { NextRequest, NextResponse } from "next/server";
import { consumeOAuthState, saveGoogleTokens } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${appUrl}/?auth=error`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?auth=missing`);
  }

  const validState = await consumeOAuthState(state);
  if (!validState) {
    return NextResponse.redirect(`${appUrl}/?auth=invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveGoogleTokens(tokens);
    return NextResponse.redirect(`${appUrl}/?auth=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl}/?auth=failed`);
  }
}
