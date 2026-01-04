// app/api/chat/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getBusinessConfig } from "@/app/config/business";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

const apiKey = (process.env.OPENAI_API_KEY || "").trim();

// inizializzo comunque, ma se manca la key rispondo con fallback
const client = new OpenAI({ apiKey: apiKey || "missing" });

function buildSystemPrompt() {
  let biz: any = {};
  try {
    biz = getBusinessConfig() as any;
  } catch {
    biz = {};
  }

  const name = biz?.headline || biz?.title || "Attività";
  const city = biz?.city || "";
  const phone = biz?.phone || "";
  const servicesShort = biz?.servicesShort || "";
  const hoursTitle = biz?.hoursTitle || "Orari";
  const hoursLines: string[] = Array.isArray(biz?.hoursLines) ? biz.hoursLines : [];

  const greeting =
    biz?.bot?.greeting ||
    `Ciao! Sono l’assistente di ${name}. Posso darti info su servizi, orari e contatti.`;

  const bookingGuide =
    biz?.bot?.bookingGuide ||
    `Per prenotare usa il box “Prenota adesso” nella pagina: scegli data e un orario disponibile.`;

  const cancelGuide =
    biz?.bot?.cancelGuide ||
    `Per annullare usa il box “Annulla prenotazione”: inserisci lo stesso telefono e la stessa data+ora della prenotazione.`;

  // Nota importante: NON prenotare in chat
  return `
Sei un assistente virtuale per ${name}${city ? ` (${city})` : ""}.
Obiettivo: dare informazioni chiare e veloci su servizi/orari/contatti e indirizzare alla prenotazione.
Regole IMPORTANTI:
- NON prendere prenotazioni in chat e NON inventare disponibilità.
- Se l’utente chiede di prenotare, rispondi: "${bookingGuide}"
- Se l’utente chiede di annullare, rispondi: "${cancelGuide}"
- Se chiedono prezzo/durata e non ci sono info certe, spiega che dipende da lunghezza capelli, tipo di taglio/sfumatura, barba, e chiedi: servizio + lunghezza + (eventuale) barba.
- Stile: amichevole, professionale, italiano, massimo 6-8 righe.

Dati attività:
- Nome: ${name}
- Servizi: ${servicesShort || "—"}
- Telefono: ${phone || "—"}
- ${hoursTitle}: ${hoursLines.length ? hoursLines.join(" | ") : "—"}

Messaggio iniziale suggerito: ${greeting}
`.trim();
}

function localFallbackAnswer(userText: string) {
  // fallback se manca OPENAI_API_KEY: risposte "safe" e utili
  let biz: any = {};
  try {
    biz = getBusinessConfig() as any;
  } catch {
    biz = {};
  }

  const name = biz?.headline || biz?.title || "Attività";
  const phone = biz?.phone || "";
  const hoursLines: string[] = Array.isArray(biz?.hoursLines) ? biz.hoursLines : [];
  const servicesShort = biz?.servicesShort || "";

  const t = (userText || "").toLowerCase();

  if (t.includes("prenot") || t.includes("appunt")) {
    return `Per prenotare con ${name} usa il box “Prenota adesso” nella pagina: scegli data e un orario disponibile. ✅`;
  }
  if (t.includes("annull") || t.includes("cancell")) {
    return `Per annullare usa il box “Annulla prenotazione”: inserisci lo stesso telefono e la stessa data+ora della prenotazione. ❌`;
  }
  if (t.includes("orari") || t.includes("apert") || t.includes("chius")) {
    return hoursLines.length
      ? `Orari: ${hoursLines.join(" • ")}`
      : `Dimmi il giorno che ti interessa e ti confermo gli orari.`;
  }
  if (t.includes("prezzo") || t.includes("costa") || t.includes("quanto")) {
    return `Il prezzo dipende dal servizio e da dettagli come lunghezza capelli, tipo di taglio/sfumatura e barba. Dimmi: servizio + lunghezza + (eventuale) barba e ti orientiamo.`;
  }
  if (t.includes("servizi") || t.includes("fate") || t.includes("taglio") || t.includes("barba") || t.includes("sfum")) {
    return servicesShort
      ? `Servizi principali: ${servicesShort}. Dimmi cosa vuoi fare (taglio, barba, sfumatura…) e ti dico come prenotare.`
      : `Dimmi che servizio ti serve (taglio, barba, taglio+barba, sfumatura…) e ti aiuto.`;
  }
  if (t.includes("telefono") || t.includes("contatt")) {
    return phone ? `Puoi contattarci al: ${phone}` : `Dimmi come preferisci essere contattato e ti dico la soluzione migliore.`;
  }

  return `Posso aiutarti con info su servizi, orari e contatti. Se vuoi prenotare usa “Prenota adesso” nella pagina.`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const userMessage = String(body?.message ?? body?.userMessage ?? "").trim();

    if (!userMessage) {
      return jsonNoStore({ ok: false, error: "Messaggio vuoto." }, { status: 400 });
    }

    // ✅ se non c'è la key, fallback (evita errore 500)
    if (!apiKey) {
      return jsonNoStore({ ok: true, reply: localFallbackAnswer(userMessage), fallback: true }, { status: 200 });
    }

    const systemPrompt = buildSystemPrompt();

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 450,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "";

    if (!reply) {
      return jsonNoStore({ ok: false, error: "Risposta vuota dal modello." }, { status: 500 });
    }

    return jsonNoStore({ ok: true, reply }, { status: 200 });
  } catch (err: any) {
    console.error("❌ /api/chat error:", err);
    return jsonNoStore(
      { ok: false, error: "Errore server (chat).", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}