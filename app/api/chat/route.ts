import { NextResponse } from "next/server";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

const client = new OpenAI({
  apiKey: apiKey ?? "",
});

type Body = {
  message?: string;
  context?: {
    businessName?: string;
    address?: string;
    phone?: string;
    mode?: string; // "INFO_ONLY"
  };
};

function looksLikeOrder(text: string) {
  const t = (text || "").toLowerCase();
  const keywords = [
    "ordino",
    "vorrei ordinare",
    "voglio ordinare",
    "prenoto",
    "prenotare",
    "tavolo per",
    "consegna",
    "asporto",
    "indirizzo",
    "citofono",
    "margherita",
    "diavola",
    "coca",
    "menu",
    "menù",
    "ordine",
  ];
  return keywords.some((k) => t.includes(k));
}

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY mancante (.env.local)" },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as Body | null;

    const message = body?.message?.toString().trim() ?? "";
    const businessName = body?.context?.businessName?.toString().trim() || "Pala Pizza 🍕";
    const address = body?.context?.address?.toString().trim() || "Via Roma 10, 00100 Roma (RM)";
    const phone = body?.context?.phone?.toString().trim() || "06 1234 5678";
    const mode = body?.context?.mode?.toString().trim() || "INFO_ONLY";

    if (!message) {
      return NextResponse.json({ error: "Messaggio mancante." }, { status: 400 });
    }

    // ✅ Blocca ordini/prenotazioni in chat: rimanda al modulo
    if (mode === "INFO_ONLY" && looksLikeOrder(message)) {
      return NextResponse.json(
        {
          reply:
            "Per ordini o prenotazioni usa il modulo “Ordina / Prenota” ✅\n" +
            "Qui in chat posso darti info su orari, indirizzo, telefono e consegna/asporto/tavolo.",
        },
        { status: 200 }
      );
    }

    const systemPrompt = `
Sei GalaxBot AI, assistente informazioni per una PIZZERIA / RISTORANTE.

REGOLA IMPORTANTISSIMA (obbligatoria):
- NON devi prendere ordini o prenotazioni via chat.
- NON devi chiedere tutti i dati per completare un ordine.
- Se l'utente vuole ordinare o prenotare: devi SEMPRE rimandarlo al modulo "Ordina / Prenota" (sul sito/app).
- Quindi: niente riepiloghi "confermo il tuo ordine", niente conferme di consegna/prenotazione, niente promesse.

Cosa PUOI fare:
- Dare informazioni generiche e utili: orari, dove si trova, telefono, come funziona asporto/consegna/tavolo.
- Se chiedono menu/prezzi: rispondi in modo GENERICO ("dipende dal menu del locale") e invita a scrivere nel modulo.
- Risposte brevi: max 4-5 frasi.
- Tono: gentile, moderno, semplice.
- Usa al massimo 1 emoji.

Dati del locale (demo):
- Nome: ${businessName}
- Indirizzo: ${address}
- Telefono: ${phone}

Quando rimandi al modulo, usa questa frase:
"Per ordini o prenotazioni usa il modulo “Ordina / Prenota” ✅"
`.trim();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.4,
    });

    const reply =
      completion.choices[0]?.message?.content?.toString().trim() ||
      "Ok ✅";

    return NextResponse.json({ reply }, { status: 200 });
  } catch (err: any) {
    console.error("Errore API /api/chat:", err);
    return NextResponse.json(
      {
        reply:
          "Mi dispiace, c'è stato un errore tecnico con il server. Riprova più tardi.",
      },
      { status: 500 }
    );
  }
}