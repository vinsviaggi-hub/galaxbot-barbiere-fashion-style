// app/api/admin/bookings/route.ts
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

function getEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

function isLoggedIn(req: Request) {
  const cookieName = getCookieName();
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
  const sessionValue = m?.[1] ? decodeURIComponent(m[1]) : "";
  const expected = getEnv("ADMIN_SESSION_SECRET");
  return Boolean(expected && sessionValue && sessionValue === expected);
}

async function safeJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Risposta non valida dal server.", details: text };
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

    // nello script Apps Script mettiamo _status nel payload
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

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), max);
}

/**
 * ✅ Richiesta prenotazione: in UI vogliamo "RICHIESTA"
 * ma lo script attuale usa ancora "NUOVA".
 * Quindi traduciamo:
 * - RICHIESTA -> NUOVA (verso script)
 * - NUOVA -> RICHIESTA (verso UI)
 */
function toScriptStatus(input: string) {
  const s = String(input || "").trim().toUpperCase();
  if (s === "RICHIESTA") return "NUOVA";
  return s;
}

function toUiStatus(input: string) {
  const s = String(input || "").trim().toUpperCase();
  if (s === "NUOVA") return "RICHIESTA";
  return s;
}

export async function GET(req: Request) {
  try {
    if (!isLoggedIn(req)) return jsonNoStore({ ok: false, error: "Non autorizzato." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = clampInt(Number(searchParams.get("limit") || "300"), 1, 1000);

    const { data, httpStatus } = await callGoogleScript({
      action: "admin_list",
      limit,
    });

    if (!data?.ok) {
      return jsonNoStore(
        { ok: false, error: data?.error || "Errore admin_list.", details: data?.details },
        { status: Number(httpStatus) || 500 }
      );
    }

    // se lo script ritorna "NUOVA", in UI la mostriamo come "RICHIESTA"
    const rows = Array.isArray(data.rows)
      ? data.rows.map((r: any) => ({
          ...r,
          status: toUiStatus(r?.status),
        }))
      : [];

    return jsonNoStore(
      { ok: true, rows, count: data.count ?? (rows.length ?? 0) },
      { status: 200 }
    );
  } catch (err: any) {
    return jsonNoStore({ ok: false, error: `Errore interno: ${String(err?.message || err)}` }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!isLoggedIn(req)) return jsonNoStore({ ok: false, error: "Non autorizzato." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const id = String(body?.id || "").trim();
    const statusRaw = String(body?.status || "").trim().toUpperCase();

    if (!id) return jsonNoStore({ ok: false, error: "ID mancante." }, { status: 400 });

    // ✅ ora supportiamo anche "RICHIESTA"
    const allowed = ["RICHIESTA", "NUOVA", "CONFERMATA", "ANNULLATA"];
    if (!allowed.includes(statusRaw)) {
      return jsonNoStore(
        { ok: false, error: "Status non valido. Usa: RICHIESTA / CONFERMATA / ANNULLATA" },
        { status: 400 }
      );
    }

    const statusForScript = toScriptStatus(statusRaw);

    const { data, httpStatus } = await callGoogleScript({
      action: "admin_set_status",
      id,
      status: statusForScript,
    });

    if (!data?.ok) {
      return jsonNoStore(
        { ok: false, error: data?.error || "Errore admin_set_status.", details: data?.details },
        { status: Number(httpStatus) || 500 }
      );
    }

    const returned = toUiStatus(data.status ?? statusForScript);

    return jsonNoStore(
      { ok: true, status: returned, message: data.message ?? "Stato aggiornato." },
      { status: 200 }
    );
  } catch (err: any) {
    return jsonNoStore({ ok: false, error: `Errore interno: ${String(err?.message || err)}` }, { status: 500 });
  }
}