// app/api/availability/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

async function safeJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "Risposta non valida dal Google Script (non JSON).",
      details: text?.slice?.(0, 800) || text,
      _status: res.status,
    };
  }
}

async function callGoogleScript(payload: Record<string, any>) {
  const url = getEnv("GOOGLE_SCRIPT_URL");
  const secret = getEnv("GOOGLE_SCRIPT_SECRET");

  if (!url) return { data: { ok: false, error: "GOOGLE_SCRIPT_URL mancante in env." }, httpStatus: 500 };
  if (!secret) return { data: { ok: false, error: "GOOGLE_SCRIPT_SECRET mancante in env." }, httpStatus: 500 };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ ...payload, secret }),
    });

    const data = await safeJson(res);

    const statusFromPayload = Number((data as any)?._status);
    const httpStatus = Number.isFinite(statusFromPayload) ? statusFromPayload : res.status;

    return { data, httpStatus };
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "Timeout chiamata Google Script."
        : `Errore chiamata Google Script: ${String(e?.message || e)}`;
    return { data: { ok: false, error: msg }, httpStatus: 500 };
  } finally {
    clearTimeout(timer);
  }
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function normalizeDateFromReq(req: Request, bodyDate?: any) {
  const { searchParams } = new URL(req.url);
  const fromQuery = String(searchParams.get("date") || "").trim();
  const fromBody = String(bodyDate || "").trim();
  return fromBody || fromQuery;
}

function normalizeModeFromReq(req: Request, bodyMode?: any) {
  const { searchParams } = new URL(req.url);
  const fromQuery = String(searchParams.get("mode") || "").trim().toUpperCase();
  const fromBody = String(bodyMode || "").trim().toUpperCase();
  const mode = fromBody || fromQuery;

  // ✅ DEFAULT: BOOKING (barbiere / prenotazioni classiche)
  if (mode === "REQUEST") return "REQUEST";
  return "BOOKING";
}

async function handle(req: Request, bodyMaybe?: any) {
  const date = normalizeDateFromReq(req, bodyMaybe?.date);
  const mode = normalizeModeFromReq(req, bodyMaybe?.mode);

  if (!date || !isIsoDate(date)) {
    return jsonNoStore({ ok: false, error: "Parametro 'date' mancante o non valido (YYYY-MM-DD)." }, { status: 400 });
  }

  const { data, httpStatus } = await callGoogleScript({
    action: "get_availability",
    date,
    // compat: se un giorno vuoi distinguere, resta pronto
    requestMode: mode === "REQUEST",
    mode,
  });

  if (!data?.ok) {
    return jsonNoStore(
      { ok: false, error: data?.error || "Errore disponibilità.", details: data?.details },
      { status: Number(httpStatus) || 500 }
    );
  }

  const freeSlots = Array.isArray(data.freeSlots) ? data.freeSlots : [];
  return jsonNoStore(
    {
      ok: true,
      date,
      mode,
      freeSlots,
    },
    { status: 200 }
  );
}

export async function GET(req: Request) {
  try {
    return await handle(req);
  } catch (err: any) {
    return jsonNoStore({ ok: false, error: `Errore interno: ${String(err?.message || err)}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return await handle(req, body);
  } catch (err: any) {
    return jsonNoStore({ ok: false, error: `Errore interno: ${String(err?.message || err)}` }, { status: 500 });
  }
}