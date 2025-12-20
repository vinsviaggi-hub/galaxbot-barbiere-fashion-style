"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

type ChatMsg = {
  role: Role;
  content: string;
};

export default function ChatBox() {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Ciao! Sono l’assistente info di Pala Pizza 🍕\n\nPosso aiutarti con:\n• Menu e pizze disponibili\n• Senza glutine / allergeni\n• Ingredienti e aggiunte\n• Info su consegna / asporto / tavolo\n\n👉 Per ORDINI o PRENOTAZIONI usa il modulo a sinistra (così finisce nel pannello).",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const examples = useMemo(
    () => [
      "Che pizze avete oggi?",
      "Avete impasto senza glutine?",
      "Allergeni: cosa contiene la margherita?",
      "Quanto tempo ci mette la consegna?",
    ],
    []
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text?: string) {
    const value = (text ?? input).trim();
    if (!value || loading) return;

    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: value }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `❌ ${data?.error || "Errore interno del server."}`,
          },
        ]);
        return;
      }

      const reply = (data?.reply ?? "").toString().trim();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply || "Ok ✅",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Errore di rete. Riprova." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter invia, Shift+Enter va a capo
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="w-full">
      {/* Area chat */}
      <div className="h-[420px] sm:h-[520px] overflow-y-auto rounded-2xl border border-black/10 bg-white/60 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="space-y-3">
          {messages.map((m, idx) => {
            const isUser = m.role === "user";
            return (
              <div
                key={idx}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={[
                    "max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[14.5px] leading-snug shadow",
                    isUser
                      ? "bg-gradient-to-br from-[#F57C00] to-[#C62828] text-white rounded-tr-md"
                      : "bg-white/90 text-zinc-900 border border-black/10 rounded-tl-md",
                  ].join(" ")}
                >
                  {m.content}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl rounded-tl-md border border-black/10 bg-white/90 px-3 py-2 text-[14.5px] text-zinc-700 shadow">
                Sto scrivendo…
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      {/* Esempi rapidi */}
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => sendMessage(t)}
            className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white active:scale-[0.99]"
          >
            {t}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 rounded-2xl border border-black/10 bg-white/60 p-2 backdrop-blur">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Chiedi menu, senza glutine, allergeni, ingredienti... (Invio per inviare, Shift+Invio a capo)"
          className="min-h-[46px] max-h-[120px] flex-1 resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[14.5px] outline-none focus:border-black/30"
        />

        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className={[
            "min-w-[96px] rounded-xl px-4 py-2 font-extrabold shadow active:scale-[0.99]",
            loading || !input.trim()
              ? "bg-zinc-300 text-zinc-600 cursor-not-allowed"
              : "bg-[#C62828] text-white hover:brightness-110",
          ].join(" ")}
        >
          {loading ? "..." : "Invia"}
        </button>
      </div>
    </div>
  );
}