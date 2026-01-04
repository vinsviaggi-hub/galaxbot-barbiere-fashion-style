// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import ChatBox from "./components/chatbox";
import { getBusinessConfig } from "@/app/config/business";

type UiMode = "PRENOTA" | "ANNULLA" | "ASSISTENZA";

function normalizePhone(s: string) {
  return String(s || "").replace(/[^\d+]/g, "").replace(/^00/, "+");
}
function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}
function isTime(s: string) {
  return /^\d{2}:\d{2}$/.test(String(s || "").trim());
}
function safeJson<T = any>(text: string): T | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Page() {
  const biz = useMemo(() => {
    try {
      return getBusinessConfig() as any;
    } catch {
      return {} as any;
    }
  }, []);

  const shopName = String(biz?.headline || biz?.title || biz?.name || "Barber Shop").trim();
  const shopCity = String(biz?.city || "").trim();
  const shopPhone = String(biz?.phone || biz?.whatsapp || "").trim(); // solo display
  const shopAddress = String(biz?.address || "").trim();

  const badgeTop = String(biz?.badgeTop || biz?.labelTop || "GALAXBOT AI • BARBER").trim();

  const services: string[] =
    Array.isArray(biz?.servicesList) && biz.servicesList.length > 0
      ? biz.servicesList
      : ["Taglio", "Barba", "Taglio + Barba", "Shampoo", "Styling"];

  const helpText =
    String(biz?.bot?.helpText || "").trim() ||
    "Scrivi qui per info su servizi, orari, prezzi e disponibilità. Per prenotare usa “Prenota ora”.";

  const [mode, setMode] = useState<UiMode>("PRENOTA");
  const [chatOpen, setChatOpen] = useState(false);

  // --- Prenota (Barbiere)
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState(services[0] || "");
  const [dateISO, setDateISO] = useState(todayISO());
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const [slotsLoading, setSlotsLoading] = useState(false);
  const [freeSlots, setFreeSlots] = useState<string[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // --- Annulla
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cDateISO, setCDateISO] = useState(todayISO());
  const [cTime, setCTime] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadAvailability(iso: string) {
    if (!isIsoDate(iso)) return;

    setSlotsLoading(true);
    setSlotsError(null);
    setFreeSlots([]);
    setTime("");

    try {
      const res = await fetch(`/api/availability?date=${encodeURIComponent(iso)}`, { cache: "no-store" });
      const txt = await res.text();
      const data = safeJson<any>(txt) ?? { ok: false, error: "Risposta non valida." };

      if (!data?.ok) {
        setSlotsError(data?.error || "Errore disponibilità.");
        return;
      }

      const slots = Array.isArray(data.freeSlots) ? data.freeSlots.filter((x: any) => isTime(String(x))) : [];
      setFreeSlots(slots);
      if (slots.length > 0) setTime(slots[0]);
    } catch {
      setSlotsError("Errore rete: impossibile caricare gli orari.");
    } finally {
      setSlotsLoading(false);
    }
  }

  useEffect(() => {
    void loadAvailability(dateISO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onChangeDate(next: string) {
    setDateISO(next);
    setSubmitMsg(null);
    await loadAvailability(next);
  }

  async function submitBooking() {
    setSubmitMsg(null);

    const p = normalizePhone(phone);
    if (!clientName.trim() || !p || !service.trim() || !isIsoDate(dateISO) || !isTime(time)) {
      setSubmitMsg({ ok: false, text: "Compila: nome cliente, telefono, servizio, data e ora." });
      return;
    }

    setSubmitLoading(true);
    try {
      // ✅ compatibilità con la tua API attuale: mando taglia/pelo fissi
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "create_booking",
          ownerName: clientName.trim(), // -> colonna nome
          name: clientName.trim(), // compatibilità
          phone: p,
          service,
          date: dateISO,
          time,
          notes: notes.trim(),
          canale: "WEB",

          // 👇 per non rompere l’API se se li aspetta
          dogName: "—",
          taglia: "—",
          pelo: "—",
        }),
      });

      const txt = await res.text();
      const data = safeJson<any>(txt) ?? { ok: false, error: "Risposta non valida." };

      if (!data?.ok) {
        setSubmitMsg({ ok: false, text: data?.error || "Prenotazione non riuscita." });
        await loadAvailability(dateISO);
        return;
      }

      setSubmitMsg({ ok: true, text: "✅ Richiesta inviata. Ti contattiamo su WhatsApp per confermare." });

      // reset + reload
      setClientName("");
      setPhone("");
      setNotes("");
      await loadAvailability(dateISO);
    } catch {
      setSubmitMsg({ ok: false, text: "Errore rete: richiesta non inviata." });
    } finally {
      setSubmitLoading(false);
    }
  }

  async function submitCancel() {
    setCancelMsg(null);

    const p = normalizePhone(cPhone);
    if (!p || !isIsoDate(cDateISO) || !isTime(cTime)) {
      setCancelMsg({ ok: false, text: "Per annullare servono: telefono, data e ora." });
      return;
    }

    setCancelLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          action: "cancel_booking",
          phone: p,
          date: cDateISO,
          time: cTime,
          ownerName: cName.trim(), // facoltativo
          dogName: "—",
        }),
      });

      const txt = await res.text();
      const data = safeJson<any>(txt) ?? { ok: false, error: "Risposta non valida." };

      if (!data?.ok) {
        setCancelMsg({ ok: false, text: data?.error || "Annullamento non riuscito." });
        return;
      }

      setCancelMsg({ ok: true, text: "✅ Richiesta di annullamento inviata." });

      // reset
      setCName("");
      setCPhone("");
      setCTime("");
    } catch {
      setCancelMsg({ ok: false, text: "Errore rete: annullamento non inviato." });
    } finally {
      setCancelLoading(false);
    }
  }

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      padding: "16px 12px 30px",
      background:
        "radial-gradient(1200px 680px at 20% 0%, rgba(246,178,26,0.16), transparent 60%)," +
        "radial-gradient(1000px 640px at 90% 10%, rgba(59,130,246,0.12), transparent 55%)," +
        "linear-gradient(180deg, #07121f 0%, #061427 35%, #071a2d 100%)",
      color: "rgba(255,255,255,0.92)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    },
    wrap: { maxWidth: 1120, margin: "0 auto" },
    header: {
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06))",
      boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
      padding: "14px 14px 12px",
    },
    titleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
    h1: { margin: 0, fontSize: 34, fontWeight: 1000, letterSpacing: -0.4, display: "flex", gap: 10, alignItems: "center" },
    sub: { margin: "6px 0 0", opacity: 0.86, lineHeight: 1.35, fontSize: 14, maxWidth: 820 },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.08)",
      fontWeight: 900,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },

    topBtns: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },
    btn: {
      padding: "11px 14px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.08)",
      color: "rgba(255,255,255,0.92)",
      fontWeight: 1000,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      userSelect: "none",
    },
    btnGold: {
      border: "1px solid rgba(246,178,26,0.35)",
      background: "linear-gradient(180deg, rgba(246,178,26,0.95), rgba(246,178,26,0.75))",
      color: "rgba(12,18,30,0.95)",
      boxShadow: "0 12px 30px rgba(246,178,26,0.18)",
    },
    btnRed: {
      border: "1px solid rgba(239,68,68,0.35)",
      background: "linear-gradient(180deg, rgba(239,68,68,0.92), rgba(239,68,68,0.68))",
      color: "rgba(255,255,255,0.95)",
      boxShadow: "0 12px 30px rgba(239,68,68,0.12)",
    },
    btnWhite: {
      border: "1px solid rgba(255,255,255,0.18)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.08))",
      color: "rgba(255,255,255,0.92)",
    },

    card: {
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06))",
      boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
      overflow: "hidden",
    },
    cardHead: {
      padding: "12px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.10)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
    },
    cardTitle: { fontWeight: 1000, letterSpacing: 0.2, display: "flex", gap: 10, alignItems: "center" },
    cardBody: { padding: 14 },
    pill: {
      padding: "7px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(0,0,0,0.18)",
      fontWeight: 900,
      fontSize: 12,
    },

    field: { display: "grid", gap: 6 },
    label: { fontSize: 12, opacity: 0.9, fontWeight: 900, letterSpacing: 0.2 },
    input: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(0,0,0,0.20)",
      color: "rgba(255,255,255,0.92)",
      outline: "none",
      fontWeight: 800,
      fontSize: 14,
    },
    textarea: {
      width: "100%",
      minHeight: 92,
      padding: "12px 12px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(0,0,0,0.20)",
      color: "rgba(255,255,255,0.92)",
      outline: "none",
      fontWeight: 800,
      fontSize: 14,
      resize: "vertical",
    },
    hint: { marginTop: 8, opacity: 0.82, fontSize: 13, lineHeight: 1.35 },

    alertOk: {
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(34,197,94,0.30)",
      background: "rgba(34,197,94,0.14)",
      fontWeight: 900,
    },
    alertErr: {
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(239,68,68,0.30)",
      background: "rgba(239,68,68,0.14)",
      fontWeight: 900,
    },

    rightStack: { display: "grid", gap: 12 },
    smallList: { margin: 0, paddingLeft: 18, opacity: 0.9, lineHeight: 1.4, fontWeight: 800 },
    footer: { marginTop: 14, textAlign: "center", opacity: 0.65, fontWeight: 800, fontSize: 12 },
  };

  const showBooking = mode === "PRENOTA";
  const showCancel = mode === "ANNULLA";
  const showHelp = mode === "ASSISTENZA";

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div style={styles.titleRow}>
            <div>
              <div style={styles.badge}>{badgeTop}</div>

              <div className="mm-title" style={styles.h1}>
                {shopName} <span style={{ opacity: 0.9 }}>✂️</span>
              </div>

              <p style={styles.sub}>
                Prenota scegliendo <b>data</b> e <b>orario disponibile</b>. Ti contattiamo su WhatsApp per la conferma.
              </p>

              {(shopCity || shopAddress || shopPhone) && (
                <p style={{ ...styles.sub, marginTop: 6 }}>
                  {shopCity ? <>📍 {shopCity} </> : null}
                  {shopAddress ? <>• {shopAddress} </> : null}
                  {shopPhone ? <>• 📞 {shopPhone}</> : null}
                </p>
              )}
            </div>

            <div />
          </div>

          <div className="mm-actions" style={styles.topBtns}>
            <button style={{ ...styles.btn, ...styles.btnGold }} onClick={() => setMode("PRENOTA")}>
              ⭐ Prenota ora
            </button>
            <button style={{ ...styles.btn, ...styles.btnRed }} onClick={() => setMode("ANNULLA")}>
              ❌ Annulla
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnWhite }}
              onClick={() => {
                setMode("ASSISTENZA");
                setChatOpen(true);
              }}
            >
              💬 Assistenza
            </button>
          </div>
        </div>

        <div className="mm-layout">
          {/* LEFT */}
          <div className="mm-card" style={styles.card}>
            <div style={styles.cardHead}>
              <div style={styles.cardTitle}>
                {showBooking ? "⭐ Richiesta prenotazione" : showCancel ? "❌ Richiesta annullamento" : "💬 Assistenza"}
              </div>
              <div style={styles.pill}>
                {showBooking ? "Nome → data → ora → invia" : showCancel ? "Telefono + data + ora → invia" : "Scrivi in chat"}
              </div>
            </div>

            <div style={styles.cardBody}>
              {showBooking && (
                <>
                  <div className="mm-form-grid">
                    <div style={styles.field}>
                      <div style={styles.label}>Nome cliente *</div>
                      <input
                        style={styles.input}
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Es. Marco Rossi"
                        autoComplete="name"
                      />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>Telefono (WhatsApp) *</div>
                      <input
                        style={styles.input}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Es. +39 333 123 4567"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>Servizio *</div>
                      <select style={styles.input as any} value={service} onChange={(e) => setService(e.target.value)}>
                        {services.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>Data *</div>
                      <input
                        style={styles.input}
                        type="date"
                        value={dateISO}
                        min={todayISO()}
                        onChange={(e) => void onChangeDate(e.target.value)}
                      />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>Orario disponibile *</div>
                      <select
                        style={styles.input as any}
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        disabled={slotsLoading || freeSlots.length === 0}
                      >
                        {slotsLoading ? <option>Carico…</option> : null}
                        {!slotsLoading && freeSlots.length === 0 ? <option>Nessun orario</option> : null}
                        {freeSlots.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {slotsError ? <div style={styles.alertErr}>{slotsError}</div> : null}

                  <div style={{ ...styles.field, marginTop: 10 }}>
                    <div style={styles.label}>Note (facoltative)</div>
                    <textarea
                      style={styles.textarea}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Es. sfumatura alta, solo forbici, barba corta…"
                    />
                  </div>

                  <div className="mm-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                    <button
                      style={{ ...styles.btn, ...styles.btnGold }}
                      onClick={submitBooking}
                      disabled={submitLoading || slotsLoading}
                    >
                      {submitLoading ? "Invio…" : "⭐ Richiedi prenotazione"}
                    </button>
                  </div>

                  {submitMsg ? (
                    <div style={submitMsg.ok ? styles.alertOk : styles.alertErr}>{submitMsg.text}</div>
                  ) : (
                    <div style={styles.hint}>Dopo l’invio, ti contattiamo su WhatsApp per confermare.</div>
                  )}
                </>
              )}

              {showCancel && (
                <>
                  <div className="mm-form-grid">
                    <div style={styles.field}>
                      <div style={styles.label}>Nome (facoltativo)</div>
                      <input
                        style={styles.input}
                        value={cName}
                        onChange={(e) => setCName(e.target.value)}
                        placeholder="Es. Marco"
                      />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>Telefono (WhatsApp) *</div>
                      <input
                        style={styles.input}
                        value={cPhone}
                        onChange={(e) => setCPhone(e.target.value)}
                        placeholder="Es. +39 333 123 4567"
                        inputMode="tel"
                      />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>Data *</div>
                      <input
                        style={styles.input}
                        type="date"
                        value={cDateISO}
                        min={todayISO()}
                        onChange={(e) => setCDateISO(e.target.value)}
                      />
                    </div>

                    <div style={styles.field}>
                      <div style={styles.label}>Ora *</div>
                      <input
                        style={styles.input}
                        type="time"
                        value={cTime}
                        onChange={(e) => setCTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mm-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                    <button style={{ ...styles.btn, ...styles.btnRed }} onClick={submitCancel} disabled={cancelLoading}>
                      {cancelLoading ? "Invio…" : "❌ Invia richiesta annullamento"}
                    </button>
                  </div>

                  {cancelMsg ? (
                    <div style={cancelMsg.ok ? styles.alertOk : styles.alertErr}>{cancelMsg.text}</div>
                  ) : (
                    <div style={styles.hint}>Inserisci gli stessi dati usati in prenotazione (telefono + data + ora).</div>
                  )}
                </>
              )}

              {showHelp && (
                <>
                  <div style={{ opacity: 0.88, fontWeight: 800, lineHeight: 1.4 }}>{helpText}</div>

                  <div className="mm-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                    <button style={{ ...styles.btn, ...styles.btnGold }} onClick={() => setChatOpen(true)}>
                      ⭐ Apri chat assistenza
                    </button>
                  </div>

                  {chatOpen ? (
                    <div style={{ marginTop: 12 }}>
                      <ChatBox />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div style={styles.rightStack}>
            <div className="mm-card" style={styles.card}>
              <div style={styles.cardHead}>
                <div style={styles.cardTitle}>✅ Come funziona</div>
                <div style={{ ...styles.pill, borderColor: "rgba(246,178,26,0.25)" }}>veloce</div>
              </div>
              <div style={styles.cardBody}>
                <ol style={styles.smallList}>
                  <li>Scegli la data</li>
                  <li>Seleziona un orario disponibile</li>
                  <li>Invia la richiesta</li>
                  <li>Conferma su WhatsApp</li>
                </ol>
              </div>
            </div>

            <div className="mm-card" style={styles.card}>
              <div style={styles.cardHead}>
                <div style={styles.cardTitle}>💬 Assistenza</div>
              </div>
              <div style={styles.cardBody}>
                <div style={{ opacity: 0.88, fontWeight: 800, lineHeight: 1.35 }}>
                  Hai dubbi su servizi o disponibilità? Apri la chat assistenza.
                </div>

                <div className="mm-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                  <button
                    style={{ ...styles.btn, ...styles.btnGold }}
                    onClick={() => {
                      setMode("ASSISTENZA");
                      setChatOpen(true);
                    }}
                  >
                    ⭐ Apri chat assistenza
                  </button>
                </div>
              </div>
            </div>

            <div className="mm-card" style={styles.card}>
              <div style={styles.cardHead}>
                <div style={styles.cardTitle}>❌ Annullamento</div>
              </div>
              <div style={styles.cardBody}>
                <div style={{ opacity: 0.88, fontWeight: 800, lineHeight: 1.35 }}>
                  Se devi annullare, invia la richiesta con telefono + data + ora.
                </div>
                <div className="mm-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
                  <button style={{ ...styles.btn, ...styles.btnRed }} onClick={() => setMode("ANNULLA")}>
                    ❌ Vai ad annullamento
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.footer}>GalaxBot AI</div>
      </div>

      <style>{`
        .mm-layout{
          margin-top: 12px;
          display: grid;
          grid-template-columns: 1.35fr 0.85fr;
          gap: 12px;
          align-items: start;
        }
        .mm-form-grid{
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        @media (max-width: 980px) {
          .mm-layout{ grid-template-columns: 1fr !important; }
        }

        @media (max-width: 520px) {
          .mm-form-grid{ grid-template-columns: 1fr !important; }

          .mm-actions{ flex-direction: column !important; }
          .mm-actions button, .mm-actions a{
            width: 100% !important;
            justify-content: center !important;
          }

          input, select, textarea{
            font-size: 16px !important;
            min-height: 44px;
          }

          .mm-title{
            font-size: 34px !important;
            line-height: 1.05 !important;
          }
        }
      `}</style>
    </div>
  );
}