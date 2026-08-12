import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  deriveAccessCookieToken,
  getAccessCode,
} from "../../../../lib/access";

export async function POST(request: Request) {
  const accessCode = getAccessCode();
  if (!accessCode) {
    return NextResponse.json(
      { error: "Access code is not configured" },
      { status: 503 },
    );
  }

  let code = "";

  try {
    const body = (await request.json()) as { code?: string };
    code = body.code?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (code !== accessCode) {
    return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    ACCESS_COOKIE_NAME,
    await deriveAccessCookieToken(accessCode),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  );

  return response;
}
