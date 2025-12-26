// app/api/admin/logout/route.ts
import { NextResponse } from "next/server";
import { getCookieName } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

function clearCookie(res: NextResponse) {
  res.cookies.set(getCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

export async function POST() {
  const res = jsonNoStore({ ok: true });
  return clearCookie(res);
}

export async function GET(req: Request) {
  // ✅ dopo logout vai sempre al login NUOVO
  const res = NextResponse.redirect(new URL("/pannello/login", req.url));
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return clearCookie(res);
}