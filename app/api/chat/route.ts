import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const apiKey = process.env.OPENAI_API_KEY;

const client = new OpenAI({
  apiKey: apiKey ?? "",
});

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY non configurata sul server." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const userMessage = body?.message?.toString().trim();
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!userMessage) {
      return NextResponse.json({ error: "Messaggio mancante." }, { status: 400 });
    }

    // ✅ BOT PIZZERIA: informativo + spinge al modulo ordine
    const systemPrompt = `
Sei l'assistente virtuale di una pizzeria chiamata "Pala Pizza".

OBIETTIVO:
- Dare risposte CHIARE e VELOCI su: orari indicativi, asporto/consegna/tavolo, tempi medi, zona consegna (se non sai: dillo), come scrivere l'ordine, allergeni, metodi di pagamento (se non sai: dillo), info generali.
- Aiutare l'utente a compilare bene il modulo ordine.

REGOLE IMPORTANTI:
1) NON prendere ordini completi in chat. Se l’utente vuole ordinare o prenotare, invitalo SEMPRE a usare il modulo.
2) Se l'utente chiede "voglio ordinare / prenotare / consegna / asporto / tavolo / oggi / stasera / pizza / ordine", rispondi:
   "Per ordinare compila il modulo qui sopra: è più veloce e arriva subito alla pizzeria."
3) Massimo 6-7 righe. Tono amichevole, diretto, senza papiri.
4) Se manca un’informazione, fai AL MASSIMO 1 domanda.
5) Se chiedono prezzi e non li hai: dì che "i prezzi/menu verranno inseriti a breve (demo)" e invita al modulo.
`;

    // prendo un po’ di contesto dagli ultimi messaggi (max 8)
    const last = history.slice(-8).map((m: any) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: String(m?.content || ""),
    }));

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        ...last,
        { role: "user", content: userMessage },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Ok! Dimmi pure cosa ti serve 🙂";

    return NextResponse.json({ ok: true, reply });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Errore server chat.", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}