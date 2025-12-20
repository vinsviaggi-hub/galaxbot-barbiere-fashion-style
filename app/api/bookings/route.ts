import { NextResponse } from "next/server";

type BookingPayload = {
  nome?: string;
  telefono?: string;
  tipo?: string; // ASPORTO | CONSEGNA | TAVOLO (o simili)
  data?: string; // YYYY-MM-DD
  ora?: string; // HH:mm
  ordine?: string;
  indirizzo?: string;
  note?: string;

  // deve essere "BOT" oppure "MANUALE"
  botOrManuale?: string;

  negozio?: string; // "Pala Pizza"
};

function isValidDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}
function isValidTime(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

function normalizeBotOrManuale(v: string) {
  const up = (v || "").toString().trim().toUpperCase();
  if (up === "BOT") return "BOT";
  // tutto il resto lo trattiamo come MANUALE (APP/WEBAPP/FORM ecc.)
  return "MANUALE";
}

export async function POST(req: Request) {
  try {
    const BOOKING_WEBAPP_URL = process.env.BOOKING_WEBAPP_URL;

    if (!BOOKING_WEBAPP_URL) {
      return NextResponse.json(
        { error: "BOOKING_WEBAPP_URL mancante (.env.local)" },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as BookingPayload | null;

    const nome = body?.nome?.toString().trim() ?? "";
    const telefono = body?.telefono?.toString().trim() ?? "";
    const tipo = body?.tipo?.toString().trim() ?? "";
    const data = body?.data?.toString().trim() ?? "";
    const ora = body?.ora?.toString().trim() ?? "";
    const ordine = body?.ordine?.toString().trim() ?? "";
    const indirizzo = body?.indirizzo?.toString().trim() ?? "";
    const note = body?.note?.toString().trim() ?? "";
    const negozio = body?.negozio?.toString().trim() ?? "Pala Pizza";

    // ✅ QUI: default = MANUALE (per il form)
    const botOrManuale = normalizeBotOrManuale(body?.botOrManuale ?? "MANUALE");

    // ✅ validazioni base
    if (!nome || !telefono || !tipo || !data || !ora || !ordine) {
      return NextResponse.json(
        {
          error:
            "Campi obbligatori mancanti (nome, telefono, tipo, data, ora, ordine).",
        },
        { status: 400 }
      );
    }
    if (!isValidDate(data)) {
      return NextResponse.json(
        { error: "Formato data non valido (YYYY-MM-DD)." },
        { status: 400 }
      );
    }
    if (!isValidTime(ora)) {
      return NextResponse.json(
        { error: "Formato ora non valido (HH:mm)." },
        { status: 400 }
      );
    }

    const tipoLower = tipo.toLowerCase();
    if (tipoLower === "consegna" && !indirizzo) {
      return NextResponse.json(
        { error: "Per la consegna serve l’indirizzo." },
        { status: 400 }
      );
    }

    // ✅ payload verso Apps Script:
    // Deve combaciare con le colonne del foglio:
    // Timestamp | Nome | Telefono | Tipo | Data | Ora | Ordine | Indirizzo | Stato | Bot o Manuale | Note
    const forward = {
      nome,
      telefono,
      tipo,
      data,
      ora,
      ordine,
      indirizzo,
      stato: "NUOVO",
      botOrManuale, // <-- QUI dentro scrive "MANUALE" o "BOT"
      note,
      negozio,

      // se il tuo script usa "source" per compilare la colonna, ora è uguale a botOrManuale
      source: botOrManuale,

      ts: new Date().toISOString(),
    };

    // ⚠️ Apps Script spesso gradisce text/plain
    const res = await fetch(BOOKING_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(forward),
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Errore Apps Script: ${res.status} ${res.statusText}`,
          details: text,
        },
        { status: 502 }
      );
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {}

    return NextResponse.json({
      ok: true,
      message: "Inviato al pannello ✅",
      response: parsed ?? text,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Errore server bookings.", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST su /api/bookings" });
}