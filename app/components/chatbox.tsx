"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./chatbox.module.css";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatBox() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Ciao! Sono il bot di Pala Pizza 🍕\nPosso aiutarti con: orari, asporto/consegna, tempi, allergeni e come scrivere l’ordine.\nPer ordinare usa il modulo qui sopra 🙂",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    const next = [...messages, { role: "user", content: text } as Msg];
    setMessages(next);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: next }),
      });

      const out = await res.json().catch(() => null);
      if (!res.ok || !out?.reply) {
        setMessages((m) => [...m, { role: "assistant", content: out?.error || "Errore. Riprova tra poco." }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: out.reply }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Errore rete. Controlla connessione." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.chatWrap}>
      <div className={styles.chatHead}>
        <p className={styles.chatTitle}>Hai dubbi? Chiedi al bot 🍕</p>
        <p className={styles.chatSub}>Risposte rapide su orari, consegna/asporto, allergeni, ordine.</p>
      </div>

      <div className={styles.chatList} ref={listRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={`${styles.bubble} ${m.role === "user" ? styles.user : styles.assistant}`}
          >
            {m.content}
          </div>
        ))}
        {loading && <div className={`${styles.bubble} ${styles.assistant}`}>Sto scrivendo…</div>}
      </div>

      <div className={styles.chatBar}>
        <input
          className={styles.chatInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Scrivi una domanda…"
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className={styles.chatSend} onClick={send} disabled={loading}>
          Invia
        </button>
      </div>
    </div>
  );
}
