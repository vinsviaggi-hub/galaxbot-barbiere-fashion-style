// app/api/bookings/route.ts
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

// accetta YYYY-MM-DD oppure DD/MM/YYYY
function normalizeDateToIso(input: string) {
  const s = String(input || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}
function isTime(s: string) {
  return /^\d{2}:\d{2}$/.test(String(s || "").trim());
}
function normalizePhone(s: string) {
  // tiene numeri e "+"; trasforma 00 in +
  return String(s || "").replace(/[^\d+]/g, "").replace(/^00/, "+");
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

async function callScript(payload: Record<string, any>) {
  const url = getEnv("GOOGLE_SCRIPT_URL");
  const secret = getEnv("GOOGLE_SCRIPT_SECRET");

  if (!url) return { data: { ok: false, error: "GOOGLE_SCRIPT_URL mancante nelle env." }, httpStatus: 500 };
  if (!secret) return { data: { ok: false, error: "GOOGLE_SCRIPT_SECRET mancante nelle env." }, httpStatus: 500 };

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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (!action) return jsonNoStore({ ok: false, error: "Azione mancante." }, { status: 400 });

    // =========================
    // CREATE BOOKING (BARBIERE)
    // =========================
    if (action === "create_booking") {
      const name = String(body?.name || "").trim();
      const phone = normalizePhone(String(body?.phone || "").trim());
      const service = String(body?.service || "").trim();

      const dateRaw = String(body?.date || "").trim();
      const date = normalizeDateToIso(dateRaw); // YYYY-MM-DD

      const time = String(body?.time || "").trim(); // HH:mm
      const notes = String(body?.notes || "").trim();
      const canale = String(body?.canale || "WEB").trim(); // WEB / BOT

      if (!name || !phone || !service || !isIsoDate(date) || !isTime(time)) {
        return jsonNoStore(
          {
            ok: false,
            error: "Campi obbligatori: name, phone, service, date(YYYY-MM-DD o DD/MM/YYYY), time(HH:mm).",
          },
          { status: 400 }
        );
      }

      const { data, httpStatus } = await callScript({
        action: "create_booking",
        name,
        phone,
        service,
        date,
        time,
        notes,
        canale,
      });

      if (!data?.ok) {
        const status = Number(httpStatus) || ((data as any)?.conflict ? 409 : 500);
        return jsonNoStore(
          {
            ok: false,
            error: data?.error || "Errore durante la prenotazione.",
            conflict: Boolean((data as any)?.conflict),
            details: data?.details,
          },
          { status }
        );
      }

      return jsonNoStore(
        { ok: true, message: data?.message || "Prenotazione registrata.", id: (data as any)?.id },
        { status: 200 }
      );
    }

    // =========================
    // CANCEL BOOKING (BARBIERE)
    // =========================
    if (action === "cancel_booking") {
      const phone = normalizePhone(String(body?.phone || "").trim());

      const dateRaw = String(body?.date || "").trim();
      const date = normalizeDateToIso(dateRaw);

      const time = String(body?.time || "").trim(); // HH:mm

      if (!phone || !isIsoDate(date) || !isTime(time)) {
        return jsonNoStore(
          { ok: false, error: "Per annullare servono: phone, date(YYYY-MM-DD o DD/MM/YYYY) e time(HH:mm)." },
          { status: 400 }
        );
      }

      const { data, httpStatus } = await callScript({
        action: "cancel_booking",
        phone,
        date,
        time,
      });

      if (!data?.ok) {
        return jsonNoStore(
          { ok: false, error: data?.error || "Errore durante l'annullamento.", details: data?.details },
          { status: Number(httpStatus) || 500 }
        );
      }

      return jsonNoStore({ ok: true, message: data?.message || "Prenotazione annullata." }, { status: 200 });
    }

    return jsonNoStore({ ok: false, error: `Azione non supportata: ${action}` }, { status: 400 });
  } catch (e: any) {
    return jsonNoStore({ ok: false, error: "Errore interno.", details: String(e?.message || e) }, { status: 500 });
  }
}