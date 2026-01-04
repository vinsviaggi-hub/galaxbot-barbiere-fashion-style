// app/components/chatbox.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./chatbox.module.css";
import { getBusinessConfig } from "@/app/config/business";

type ChatRole = "user" | "assistant";

type ChatMsg = {
  role: ChatRole;
  content: string;
  ts: number;
};

type ChatApiOk = { ok: true; reply: string };
type ChatApiErr = { ok: false; error?: string };
type ChatApiResp = ChatApiOk | ChatApiErr;

function safeNow() {
  return Date.now();
}

export default function ChatBox() {
  const biz = useMemo(() => {
    try {
      return getBusinessConfig() as any;
    } catch {
      return {} as any;
    }
  }, []);

  const headerTitle = biz?.helpCardTitle ?? "Assistenza";
  const headerBadge = biz?.badgeTop ?? biz?.labelTop ?? "GALAXBOT AI";

  const greeting =
    biz?.bot?.greeting ??
    "Ciao! Dimmi pure cosa ti serve 😊\nPosso aiutarti con orari, servizi e info generali.";

  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    { role: "assistant", content: greeting, ts: safeNow() },
  ]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState<string>("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    return () => {
      // cleanup: se cambi pagina mentre sta rispondendo
      abortRef.current?.abort();
    };
  }, []);

  async function sendMessage() {
    const content = text.trim();
    if (!content || sending) return;

    setHint("");
    setSending(true);

    const userMsg: ChatMsg = { role: "user", content, ts: safeNow() };
    setMessages((prev) => [...prev, userMsg]);
    setText("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          message: content,
          // contesto utile lato server (se lo usi)
          business: {
            slug: biz?.slug,
            headline: biz?.headline,
            badgeTop: biz?.badgeTop,
            servicesShort: biz?.servicesShort,
            city: biz?.city,
            phone: biz?.phone,
            hoursTitle: biz?.hoursTitle,
            hoursLines: biz?.hoursLines,
          },
        }),
      });

      const data = (await res.json().catch(() => null)) as ChatApiResp | null;

      if (!data || typeof data !== "object" || !("ok" in data)) {
        setHint("Risposta non valida dal server.");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Mi dispiace, ho avuto un problema tecnico. Riprova tra poco.",
            ts: safeNow(),
          },
        ]);
        return;
      }

      if (!data.ok) {
        setHint(data.error || "Errore chat.");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Mi dispiace, al momento non riesco a rispondere. Riprova tra poco.",
            ts: safeNow(),
          },
        ]);
        return;
      }

      const reply = String((data as any).reply ?? "").trim() || "Ok ✅";
      setMessages((prev) => [...prev, { role: "assistant", content: reply, ts: safeNow() }]);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setHint("Errore di rete.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sembra ci sia un problema di connessione. Riprova tra poco.",
          ts: safeNow(),
        },
      ]);
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(ts: number) {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  return (
    <div className={styles.chatWrap}>
      <div className={styles.header}>
        <div className={styles.title}>
          💬 {headerTitle}
          <span className={styles.badge}>{headerBadge}</span>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.messages} ref={listRef}>
          {messages.map((m, i) => (
            <div
              key={`${m.ts}-${i}`}
              className={`${styles.row} ${m.role === "user" ? styles.rowUser : styles.rowBot}`}
            >
              <div className={`${styles.bubble} ${m.role === "user" ? styles.userBubble : styles.botBubble}`}>
                {m.content}
                <div className={`${styles.meta} ${m.role === "user" ? styles.metaUser : styles.metaBot}`}>
                  {m.role === "user" ? "Tu" : "Assistente"} • {formatTime(m.ts)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.composer}>
          <input
            className={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={sending ? "Sto rispondendo…" : "Scrivi un messaggio…"}
            disabled={sending}
            autoComplete="off"
          />
          <button className={styles.sendBtn} onClick={sendMessage} disabled={sending || !text.trim()}>
            {sending ? "Invio…" : "Invia"}
          </button>
        </div>

        {hint ? <div className={styles.hint}>{hint}</div> : null}
      </div>
    </div>
  );
}