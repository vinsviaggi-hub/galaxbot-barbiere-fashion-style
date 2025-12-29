// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getBusinessConfig } from "@/app/config/business";

type ApiOk = { ok: true; message?: string; id?: string; freeSlots?: string[] };
type ApiErr = { ok: false; error?: string; details?: any; conflict?: boolean };

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}
function isTime(s: string) {
  return /^\d{2}:\d{2}$/.test(String(s || "").trim());
}

function toISOFromDateInput(v: string) {
  // input type="date" => YYYY-MM-DD
  return String(v || "").trim();
}

function normalizePhoneForWhatsapp(raw: string) {
  // Mantiene + e numeri, converte 00 -> +
  return String(raw || "")
    .trim()
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+")
    .replace(/^\+/, "") // wa vuole senza +
    .trim();
}

function normalizePhoneForAPI(raw: string) {
  return String(raw || "")
    .trim()
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+")
    .trim();
}

function waLink(shopPhone: string, msg: string) {
  const phone = normalizePhoneForWhatsapp(shopPhone);
  const text = encodeURIComponent(msg);
  const t = Date.now();
  return `https://api.whatsapp.com/send?phone=${phone}&text=${text}&t=${t}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Home4Zampe() {
  const biz = useMemo(() => {
    try {
      return getBusinessConfig() as any;
    } catch {
      return {} as any;
    }
  }, []);

  // ⚠️ Metti qui il numero WhatsApp reale del negozio (con +39 oppure 0039)
  const SHOP_PHONE = biz?.phone ?? biz?.whatsapp ?? "+39 333 123 4567";
  const TITLE = biz?.title ?? "4 Zampe";

  const [tab, setTab] = useState<"prenota" | "annulla" | "assistenza">("prenota");

  // ===== PRENOTA (RICHIESTA) =====
  const [ownerName, setOwnerName] = useState("");
  const [dogName, setDogName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("Bagno + Asciugatura");
  const [taglia, setTaglia] = useState("Media");
  const [pelo, setPelo] = useState("Medio");
  const [dateISO, setDateISO] = useState(todayISO());
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const [freeSlots, setFreeSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // ===== ANNULLA (RICHIESTA) =====
  const [cOwner, setCOwner] = useState("");
  const [cDog, setCDog] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cDateISO, setCDateISO] = useState(todayISO());
  const [cTime, setCTime] = useState(""); // HH:mm
  const [canceling, setCanceling] = useState(false);

  function show(type: "ok" | "err", msg: string) {
    setBanner({ type, msg });
    window.setTimeout(() => setBanner(null), 2600);
  }

  async function fetchSlots(date: string) {
    if (!isIsoDate(date)) return;
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const txt = await res.text();
      const data = safeJson(txt) as (ApiOk | ApiErr | null);
      if (!data || !(data as any).ok) {
        setFreeSlots([]);
        setTime("");
        return;
      }
      const slots = Array.isArray((data as any).freeSlots) ? ((data as any).freeSlots as string[]) : [];
      setFreeSlots(slots.filter(isTime));
      // se l'ora selezionata non c'è più, la resetto
      if (time && !slots.includes(time)) setTime("");
    } catch {
      setFreeSlots([]);
      setTime("");
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    fetchSlots(dateISO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSlots(dateISO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  function buildRequestMsg(id?: string) {
    const lines = [
      `Ciao! Vorrei richiedere un appuntamento da ${TITLE}.`,
      "",
      `• Proprietario: ${ownerName || "-"}`,
      `• Cane: ${dogName || "-"}`,
      `• Telefono: ${phone || "-"}`,
      `• Servizio: ${service || "-"}`,
      `• Taglia: ${taglia || "-"}`,
      `• Pelo: ${pelo || "-"}`,
      `• Data: ${dateISO || "-"}`,
      `• Ora: ${time || "-"}`,
      notes ? `• Note: ${notes}` : "",
      id ? `• ID: ${id}` : "",
      "",
      "Attendo conferma su WhatsApp, grazie!",
    ].filter(Boolean);
    return lines.join("\n");
  }

  function buildCancelMsg() {
    const lines = [
      `Ciao! Vorrei richiedere l'annullamento di un appuntamento da ${TITLE}.`,
      "",
      `• Proprietario: ${cOwner || "-"}`,
      `• Cane: ${cDog || "-"}`,
      `• Telefono: ${cPhone || "-"}`,
      `• Data: ${cDateISO || "-"}`,
      `• Ora: ${cTime || "-"}`,
      "",
      "Grazie!",
    ].filter(Boolean);
    return lines.join("\n");
  }

  async function submitRequest() {
    const p = normalizePhoneForAPI(phone);

    if (!ownerName.trim() || !dogName.trim() || !p || !service.trim() || !taglia.trim() || !pelo.trim() || !isIsoDate(dateISO) || !isTime(time)) {
      show("err", "Compila: proprietario, cane, telefono, servizio, taglia, pelo, data e ora.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "create_booking",
          ownerName: ownerName.trim(),
          dogName: dogName.trim(),
          phone: p,
          service: service.trim(),
          taglia: taglia.trim(),
          pelo: pelo.trim(),
          date: dateISO,
          time,
          notes: notes.trim(),
          canale: "WEB",
        }),
      });

      const txt = await res.text();
      const data = safeJson(txt) as (ApiOk | ApiErr | null);

      if (!data || !(data as any).ok) {
        const conflict = Boolean((data as any)?.conflict);
        show("err", conflict ? "Orario già occupato: cambia ora o data." : ((data as any)?.error || "Errore invio richiesta."));
        return;
      }

      show("ok", "Richiesta inviata. Ti contattiamo su WhatsApp per la conferma.");
      // Apro WhatsApp con messaggio completo
      window.open(waLink(SHOP_PHONE, buildRequestMsg((data as any).id)), `wa_req_${Date.now()}`, "noopener,noreferrer");
    } catch {
      show("err", "Errore di rete. Riprova.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCancel() {
    const p = normalizePhoneForAPI(cPhone);

    if (!cOwner.trim() || !cDog.trim() || !p || !isIsoDate(cDateISO) || !isTime(cTime)) {
      show("err", "Compila: proprietario, cane, telefono, data e ora (HH:mm).");
      return;
    }

    setCanceling(true);
    try {
      // ✅ annullamento in sistema (così libera lo slot)
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "cancel_booking",
          ownerName: cOwner.trim(),
          dogName: cDog.trim(),
          phone: p,
          date: cDateISO,
          time: cTime,
        }),
      });

      const txt = await res.text();
      const data = safeJson(txt) as (ApiOk | ApiErr | null);

      if (!data || !(data as any).ok) {
        show("err", (data as any)?.error || "Errore annullamento.");
        return;
      }

      show("ok", "Richiesta annullamento inviata.");
      // WhatsApp per sicurezza (il negozio vede subito)
      window.open(waLink(SHOP_PHONE, buildCancelMsg()), `wa_cancel_${Date.now()}`, "noopener,noreferrer");
    } catch {
      show("err", "Errore di rete. Riprova.");
    } finally {
      setCanceling(false);
    }
  }

  // ===== STILI (più scuro, leggibile su telefono) =====
  const C = {
    bgTop: "#08142a",
    bgMid: "#0b1d3b",
    glass: "rgba(255,255,255,0.06)",
    glass2: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.14)",
    text: "rgba(255,255,255,0.92)",
    sub: "rgba(255,255,255,0.78)",
    gold: "#f5b301", // oro più vivo
    gold2: "#ffcc3a",
    red: "#ef4444",
    red2: "#ff5a5a",
    whiteBtn: "rgba(255,255,255,0.12)",
    whiteBtnB: "rgba(255,255,255,0.18)",
  };

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      padding: "18px 12px 28px",
      background:
        `radial-gradient(900px 520px at 18% 8%, rgba(245,179,1,0.10), transparent 60%),` +
        `radial-gradient(900px 520px at 82% 0%, rgba(59,130,246,0.16), transparent 62%),` +
        `radial-gradient(900px 520px at 50% 100%, rgba(239,68,68,0.10), transparent 60%),` +
        `linear-gradient(180deg, ${C.bgTop} 0%, ${C.bgMid} 46%, #071125 100%)`,
      color: C.text,
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    },
    container: { maxWidth: 1100, margin: "0 auto" },

    topBar: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    brand: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
    },
    title: { fontSize: 34, fontWeight: 1000, letterSpacing: -0.6, margin: 0 },
    subtitle: { margin: "2px 0 0", color: C.sub, fontWeight: 650, lineHeight: 1.35 },

    pillRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },

    btnGold: {
      border: `1px solid rgba(245,179,1,0.40)`,
      background: `linear-gradient(90deg, ${C.gold}, ${C.gold2})`,
      color: "#1a1402",
      padding: "10px 12px",
      borderRadius: 12,
      fontWeight: 1000,
      cursor: "pointer",
      boxShadow: "0 14px 34px rgba(245,179,1,0.18)",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    btnRed: {
      border: `1px solid rgba(239,68,68,0.40)`,
      background: `linear-gradient(90deg, ${C.red}, ${C.red2})`,
      color: "#1b0606",
      padding: "10px 12px",
      borderRadius: 12,
      fontWeight: 1000,
      cursor: "pointer",
      boxShadow: "0 14px 34px rgba(239,68,68,0.16)",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    btnWhite: {
      border: `1px solid ${C.whiteBtnB}`,
      background: C.whiteBtn,
      color: C.text,
      padding: "10px 12px",
      borderRadius: 12,
      fontWeight: 900,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      backdropFilter: "blur(10px)",
    },

    card: {
      borderRadius: 18,
      border: `1px solid ${C.border}`,
      background: `linear-gradient(180deg, ${C.glass2}, ${C.glass})`,
      boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
      overflow: "hidden",
      backdropFilter: "blur(12px)",
    },
    cardInner: { padding: 14 },

    grid: { display: "grid", gap: 14, gridTemplateColumns: "1.2fr 0.8fr" },

    sectionTitle: { margin: "0 0 10px", fontSize: 16, fontWeight: 1000, letterSpacing: 0.2 },
    hint: { margin: 0, color: C.sub, fontWeight: 650, fontSize: 13, lineHeight: 1.35 },

    formGrid: { display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" },

    field: { display: "grid", gap: 6 },
    label: { fontSize: 12, fontWeight: 1000, letterSpacing: 0.4, color: "rgba(255,255,255,0.88)" },
    input: {
      width: "100%",
      borderRadius: 12,
      border: `1px solid rgba(255,255,255,0.16)`,
      background: "rgba(0,0,0,0.22)",
      color: C.text,
      padding: "11px 12px",
      outline: "none",
      fontWeight: 800,
    },
    textarea: {
      width: "100%",
      minHeight: 92,
      borderRadius: 12,
      border: `1px solid rgba(255,255,255,0.16)`,
      background: "rgba(0,0,0,0.22)",
      color: C.text,
      padding: "11px 12px",
      outline: "none",
      fontWeight: 750,
      resize: "vertical",
    },

    hr: { height: 1, background: "rgba(255,255,255,0.10)", border: 0, margin: "12px 0" },

    bannerOk: {
      border: "1px solid rgba(34,197,94,0.35)",
      background: "rgba(34,197,94,0.12)",
      padding: "10px 12px",
      borderRadius: 12,
      fontWeight: 950,
      color: C.text,
      marginBottom: 12,
    },
    bannerErr: {
      border: "1px solid rgba(239,68,68,0.35)",
      background: "rgba(239,68,68,0.14)",
      padding: "10px 12px",
      borderRadius: 12,
      fontWeight: 950,
      color: C.text,
      marginBottom: 12,
    },

    sideBox: {
      borderRadius: 16,
      border: `1px solid rgba(255,255,255,0.14)`,
      background: "rgba(0,0,0,0.20)",
      padding: 12,
    },

    miniRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },

    waBtn: {
      border: `1px solid rgba(245,179,1,0.40)`,
      background: `linear-gradient(90deg, rgba(245,179,1,0.18), rgba(255,204,58,0.10))`,
      color: C.text,
      padding: "10px 12px",
      borderRadius: 12,
      fontWeight: 950,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      textDecoration: "none",
    },
  };

  const tabBtnStyle = (active: boolean, kind: "gold" | "red" | "white") => {
    const base = kind === "gold" ? styles.btnGold : kind === "red" ? styles.btnRed : styles.btnWhite;
    return {
      ...base,
      opacity: active ? 1 : 0.72,
      transform: active ? "translateY(-1px)" : "none",
    } as CSSProperties;
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div style={styles.brand}>
            <div>
              <h1 style={styles.title}>
                {TITLE} <span style={{ opacity: 0.9 }}>🐾</span>
              </h1>
              <p style={styles.subtitle}>
                Richiedi un appuntamento scegliendo <b>data</b> e <b>orario disponibile</b>. Ti contattiamo su WhatsApp per la conferma.
              </p>
            </div>
          </div>

          <div style={styles.pillRow}>
            <button style={tabBtnStyle(tab === "prenota", "gold")} onClick={() => setTab("prenota")}>
              ⭐ Prenota ora
            </button>
            <button style={tabBtnStyle(tab === "annulla", "red")} onClick={() => setTab("annulla")}>
              ❌ Annulla
            </button>
            <button style={tabBtnStyle(tab === "assistenza", "white")} onClick={() => setTab("assistenza")}>
              💬 Assistenza
            </button>

            <a style={styles.waBtn} href={waLink(SHOP_PHONE, `Ciao! Vorrei info su ${TITLE}.`)} target="_blank" rel="noreferrer">
              💚 Chat WhatsApp
            </a>
          </div>
        </div>

        {banner && <div style={banner.type === "ok" ? styles.bannerOk : styles.bannerErr}>{banner.msg}</div>}

        <div style={styles.card}>
          <div style={styles.cardInner}>
            {tab === "prenota" && (
              <div style={styles.grid} className="mm-grid">
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                    <div>
                      <div style={styles.sectionTitle}>⭐ Richiesta prenotazione</div>
                      <p style={styles.hint}>Compila i dati → scegli data → scegli orario disponibile → invia richiesta.</p>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <div style={{ opacity: 0.85, fontWeight: 900, fontSize: 12 }}>
                        {loadingSlots ? "Carico orari…" : freeSlots.length ? `${freeSlots.length} orari disponibili` : "Nessun orario"}
                      </div>
                    </div>
                  </div>

                  <hr style={styles.hr} />

                  <div style={styles.formGrid} className="mm-form">
                    <div style={styles.field}>
                      <div style={styles.label}>NOME PROPRIETARIO *</div>
                      <input style={styles.input} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Es. Maria Rossi" />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>NOME CANE *</div>
                      <input style={styles.input} value={dogName} onChange={(e) => setDogName(e.target.value)} placeholder="Es. Toby" />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>TELEFONO (WhatsApp) *</div>
                      <input style={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Es. +39 333 123 4567" inputMode="tel" />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>SERVIZIO *</div>
                      <select style={styles.input as any} value={service} onChange={(e) => setService(e.target.value)}>
                        <option>Bagno + Asciugatura</option>
                        <option>Toelettatura completa</option>
                        <option>Taglio</option>
                        <option>Unghie</option>
                        <option>Pulizia orecchie</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>TAGLIA *</div>
                      <select style={styles.input as any} value={taglia} onChange={(e) => setTaglia(e.target.value)}>
                        <option>Piccola</option>
                        <option>Media</option>
                        <option>Grande</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>PELO *</div>
                      <select style={styles.input as any} value={pelo} onChange={(e) => setPelo(e.target.value)}>
                        <option>Corto</option>
                        <option>Medio</option>
                        <option>Lungo</option>
                      </select>
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>DATA *</div>
                      <input
                        style={styles.input}
                        type="date"
                        value={dateISO}
                        onChange={(e) => {
                          const v = toISOFromDateInput(e.target.value);
                          setDateISO(v);
                        }}
                      />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>ORARIO DISPONIBILE *</div>
                      <select
                        style={styles.input as any}
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        disabled={loadingSlots || freeSlots.length === 0}
                      >
                        <option value="">{loadingSlots ? "Carico…" : freeSlots.length ? "Seleziona orario" : "Nessun orario"}</option>
                        {freeSlots.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={styles.field}>
                        <div style={styles.label}>NOTE (facoltative)</div>
                        <textarea
                          style={styles.textarea}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Es. cane agitato, nodi, allergie, preferenze…"
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button style={styles.btnGold} onClick={submitRequest} disabled={submitting}>
                      {submitting ? "Invio…" : "⭐ Richiedi prenotazione"}
                    </button>

                    <a
                      style={styles.waBtn}
                      href={waLink(SHOP_PHONE, buildRequestMsg())}
                      target="_blank"
                      rel="noreferrer"
                      title="Invia la richiesta anche su WhatsApp"
                    >
                      💚 Invia richiesta su WhatsApp
                    </a>
                  </div>

                  <p style={{ marginTop: 10, color: C.sub, fontWeight: 700, fontSize: 13 }}>
                    Dopo l’invio, riceverai conferma su WhatsApp.
                  </p>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div style={styles.sideBox}>
                    <div style={styles.sectionTitle}>✅ Come funziona</div>
                    <div style={{ color: C.sub, fontWeight: 750, fontSize: 13, lineHeight: 1.5 }}>
                      1) Scegli la data<br />
                      2) Seleziona un orario disponibile<br />
                      3) Invia la richiesta<br />
                      4) Ti contattiamo su WhatsApp per confermare
                    </div>
                  </div>

                  <div style={styles.sideBox}>
                    <div style={styles.sectionTitle}>💬 Assistenza</div>
                    <p style={styles.hint}>Hai dubbi su servizi o disponibilità? Scrivici su WhatsApp.</p>
                    <div style={{ marginTop: 10 }}>
                      <a style={styles.btnGold as any} href={waLink(SHOP_PHONE, `Ciao! Ho una domanda su ${TITLE}.`)} target="_blank" rel="noreferrer">
                        ⭐ Apri chat assistenza
                      </a>
                    </div>
                  </div>

                  <div style={styles.sideBox}>
                    <div style={styles.sectionTitle}>❌ Annullamento</div>
                    <p style={styles.hint}>Per annullare un appuntamento invia una richiesta con i dati corretti.</p>
                    <div style={{ marginTop: 10 }}>
                      <button style={styles.btnRed} onClick={() => setTab("annulla")}>
                        ❌ Vai a richiesta annullamento
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === "annulla" && (
              <div>
                <div style={styles.sectionTitle}>❌ Richiesta annullamento</div>
                <p style={styles.hint}>Inserisci: nome proprietario, nome cane, telefono, data e ora (con i “:”).</p>

                <hr style={styles.hr} />

                <div style={styles.formGrid} className="mm-form">
                  <div style={styles.field}>
                    <div style={styles.label}>NOME PROPRIETARIO *</div>
                    <input style={styles.input} value={cOwner} onChange={(e) => setCOwner(e.target.value)} placeholder="Es. Maria Rossi" />
                  </div>

                  <div style={styles.field}>
                    <div style={styles.label}>NOME CANE *</div>
                    <input style={styles.input} value={cDog} onChange={(e) => setCDog(e.target.value)} placeholder="Es. Toby" />
                  </div>

                  <div style={styles.field}>
                    <div style={styles.label}>TELEFONO (WhatsApp) *</div>
                    <input style={styles.input} value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="Es. +39 333 123 4567" inputMode="tel" />
                  </div>

                  <div style={styles.field}>
                    <div style={styles.label}>DATA *</div>
                    <input style={styles.input} type="date" value={cDateISO} onChange={(e) => setCDateISO(toISOFromDateInput(e.target.value))} />
                  </div>

                  <div style={styles.field}>
                    <div style={styles.label}>ORA (HH:mm) *</div>
                    <input
                      style={styles.input}
                      type="time"
                      step={60}
                      value={cTime}
                      onChange={(e) => setCTime(e.target.value)}
                      placeholder="08:30"
                    />
                  </div>

                  <div style={styles.field}>
                    <div style={styles.label}>ASSISTENZA</div>
                    <div style={{ ...styles.sideBox, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900, color: C.sub }}>Serve aiuto?</div>
                        <a style={styles.btnGold as any} href={waLink(SHOP_PHONE, `Ciao! Ho bisogno di assistenza su ${TITLE}.`)} target="_blank" rel="noreferrer">
                          ⭐ Apri chat
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={styles.btnRed} onClick={submitCancel} disabled={canceling}>
                    {canceling ? "Invio…" : "❌ Richiedi annullamento"}
                  </button>

                  <a style={styles.waBtn} href={waLink(SHOP_PHONE, buildCancelMsg())} target="_blank" rel="noreferrer">
                    💚 Richiesta annullamento su WhatsApp
                  </a>

                  <button style={styles.btnWhite} onClick={() => setTab("prenota")}>
                    ⬅ Torna a Prenota
                  </button>
                </div>
              </div>
            )}

            {tab === "assistenza" && (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={styles.sectionTitle}>💬 Assistenza</div>
                <p style={styles.hint}>
                  Per domande su servizi, preparazione del cane, prezzi o disponibilità: scrivici su WhatsApp.
                </p>

                <div style={styles.sideBox}>
                  <div style={styles.miniRow}>
                    <a style={styles.btnGold as any} href={waLink(SHOP_PHONE, `Ciao! Vorrei informazioni su ${TITLE}.`)} target="_blank" rel="noreferrer">
                      ⭐ Apri chat assistenza
                    </a>
                    <button style={styles.btnWhite} onClick={() => setTab("prenota")}>
                      ⭐ Prenota ora
                    </button>
                    <button style={styles.btnRed} onClick={() => setTab("annulla")}>
                      ❌ Annulla
                    </button>
                  </div>
                </div>

                <div style={{ color: C.sub, fontWeight: 750, fontSize: 13 }}>
                  Numero WhatsApp: <b style={{ color: C.text }}>{SHOP_PHONE}</b>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14, textAlign: "center", color: "rgba(255,255,255,0.55)", fontWeight: 750, fontSize: 12 }}>
          GalaxBot AI
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .mm-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .mm-form { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}