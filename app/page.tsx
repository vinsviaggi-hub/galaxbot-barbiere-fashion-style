// app/page.tsx
"use client";

import React, { useMemo, useRef, useState } from "react";
import ChatBox from "./components/chatbox";
import FastBookingForm from "./components/FastBookingForm";
import CancelBookingForm from "./components/CancelBookingForm";
import { getBusinessConfig } from "./config/business";

function hexToRgb(hex?: string) {
  const h = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}
function rgba(hex: string, a: number) {
  const c = hexToRgb(hex);
  if (!c) return `rgba(212,175,55,${a})`;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

export default function HomePage() {
  const biz = useMemo(() => {
    try {
      return getBusinessConfig() as any;
    } catch {
      return {} as any;
    }
  }, []);

  // ✅ usa i campi corretti del business.ts
  const brandTop = biz?.badgeTop ?? "GALAXBOT AI · BARBER SHOP";
  const title = biz?.headline ?? "Idee per la Testa 💈";
  const subtitle =
    biz?.subheadline ??
    "Un assistente virtuale che gestisce richieste, prenotazioni e cancellazioni per il tuo barber shop, 24 ore su 24.";

  const services = biz?.servicesShort ?? "Taglio, barba, sfumature, styling, bimbi";
  const city = biz?.city ?? "Castelnuovo Vomano (TE)";
  const phone = biz?.phone ?? "333 123 4567";

  const openHoursTitle = biz?.hoursTitle ?? "Orari di apertura";
  const openHoursLines: string[] =
    biz?.hoursLines ?? ["Lunedì–Sabato: 8:30–12:30 e 15:00–20:00", "Domenica: chiuso"];

  const [showHelp, setShowHelp] = useState(false);

  const refBook = useRef<HTMLDivElement>(null!);
  const refCancel = useRef<HTMLDivElement>(null!);

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 🎨 Barber theme
  const gold = biz?.theme?.primary || "#D4AF37";
  const red = biz?.theme?.danger || "#EF4444";
  const deep = "#070A0F";
  const slate = "#0B1220";

  const styles: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background:
        `radial-gradient(900px 600px at 18% 10%, ${rgba(gold, 0.22)}, transparent 58%),` +
        `radial-gradient(900px 600px at 82% 18%, ${rgba(red, 0.14)}, transparent 58%),` +
        "radial-gradient(900px 600px at 50% 120%, rgba(255,255,255,0.06), transparent 62%)," +
        `linear-gradient(180deg, ${deep} 0%, ${slate} 60%, ${deep} 100%)`,
      color: "rgba(255,255,255,0.92)",
      padding: "26px 14px 40px",
    },
    shell: { maxWidth: 980, margin: "0 auto" },

    topPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "7px 12px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.06)",
      border: `1px solid ${rgba(gold, 0.22)}`,
      backdropFilter: "blur(10px)",
      fontSize: 12,
      letterSpacing: 0.9,
      textTransform: "uppercase",
      boxShadow: `0 10px 30px ${rgba(gold, 0.08)}`,
    },

    hero: { marginTop: 12, padding: "14px 2px 10px" },
    h1: {
      fontSize: 44,
      lineHeight: 1.05,
      margin: "8px 0 10px",
      fontWeight: 900,
      letterSpacing: -0.6,
      textShadow: `0 14px 50px rgba(0,0,0,0.55), 0 0 24px ${rgba(gold, 0.10)}`,
    },
    subtitle: {
      fontSize: 16,
      lineHeight: 1.5,
      opacity: 0.9,
      maxWidth: 760,
      marginBottom: 14,
      color: "rgba(255,255,255,0.86)",
    },

    actionsRow: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 },
    btn: {
      cursor: "pointer",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 900,
      fontSize: 14,
      color: "rgba(255,255,255,0.95)",
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.14)",
    },

    // ✅ PRENOTA = ORO
    btnGold: {
      background: `linear-gradient(90deg, ${rgba(gold, 0.98)} 0%, ${rgba(gold, 0.70)} 60%, rgba(255,255,255,0.16) 140%)`,
      color: "#0A0F1A",
      border: `1px solid ${rgba(gold, 0.44)}`,
      boxShadow: `0 18px 46px ${rgba(gold, 0.16)}`,
    },

    // ✅ ANNULLA = ROSSO
    btnRed: {
      background: `linear-gradient(90deg, ${rgba(red, 0.95)} 0%, ${rgba(red, 0.65)} 120%)`,
      color: "#0A0F1A",
      border: `1px solid ${rgba(red, 0.38)}`,
      boxShadow: `0 18px 46px ${rgba(red, 0.10)}`,
    },

    smallHint: { marginTop: 10, fontSize: 13, opacity: 0.86 },

    grid: { marginTop: 18, display: "grid", gridTemplateColumns: "1fr", gap: 16 },

    card: {
      borderRadius: 18,
      background: "linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.06) 100%)",
      border: `1px solid rgba(255,255,255,0.12)`,
      boxShadow: `0 22px 70px rgba(0,0,0,0.38), 0 14px 44px ${rgba(gold, 0.06)}`,
      overflow: "hidden",
    },
    cardInner: { padding: "16px 16px 14px" },

    cardTitle: {
      fontSize: 18,
      fontWeight: 900,
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: 10,
      letterSpacing: 0.2,
    },
    cardSub: { marginTop: 6, fontSize: 13, opacity: 0.86, lineHeight: 1.45 },
    list: { marginTop: 10, marginBottom: 0, paddingLeft: 18, lineHeight: 1.6 },
    divider: { height: 1, background: "rgba(255,255,255,0.10)" },

    helpTop: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },

    // ✅ APRI CHAT = ORO
    helpBtn: {
      cursor: "pointer",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 900,
      fontSize: 14,
      border: "0",
      background: showHelp
        ? "rgba(255,255,255,0.10)"
        : `linear-gradient(90deg, ${rgba(gold, 0.98)} 0%, ${rgba(gold, 0.70)} 120%)`,
      color: showHelp ? "rgba(255,255,255,0.95)" : "#0A0F1A",
      boxShadow: showHelp ? "none" : `0 18px 46px ${rgba(gold, 0.14)}`,
    },

    footer: {
      marginTop: 18,
      textAlign: "center",
      opacity: 0.72,
      fontSize: 12,
      padding: "10px 0 2px",
    },

    heroRule: {
      marginTop: 14,
      height: 1,
      width: "100%",
      background: `linear-gradient(90deg, transparent 0%, ${rgba(gold, 0.55)} 20%, ${rgba(gold, 0.10)} 70%, transparent 100%)`,
    },
  };

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topPill}>
          <span>{brandTop}</span>
        </div>

        <header style={styles.hero}>
          <h1 style={styles.h1}>
            {title} <span aria-hidden>💈</span>
          </h1>
          <p style={styles.subtitle}>{subtitle}</p>

          <div style={styles.actionsRow}>
            <button style={{ ...styles.btn, ...styles.btnGold }} onClick={() => scrollTo(refBook)}>
              Prenota ora
            </button>

            <button style={{ ...styles.btn, ...styles.btnRed }} onClick={() => scrollTo(refCancel)}>
              Annulla
            </button>

            <button style={styles.btn} onClick={() => setShowHelp((v) => !v)}>
              {showHelp ? "Chiudi assistenza" : "Assistenza"}
            </button>
          </div>

          <div style={styles.smallHint}>
            Prenoti in pochi secondi: scegli data + ora disponibile. Se ti serve, annulli con gli stessi dati.
          </div>

          <div style={styles.heroRule} />
        </header>

        <section style={styles.grid}>
          {/* INFO */}
          <div style={styles.card}>
            <div style={styles.cardInner}>
              <h2 style={styles.cardTitle}>Informazioni principali</h2>
              <ul style={styles.list}>
                <li>
                  <b>Servizi:</b> {services}
                </li>
                <li>
                  <b>Dove:</b> {city}
                </li>
                <li>
                  <b>Telefono:</b>{" "}
                  <a
                    href={`tel:${String(phone).replace(/\s/g, "")}`}
                    style={{ color: "rgba(255,255,255,0.95)", textDecoration: "underline" }}
                  >
                    {phone}
                  </a>
                </li>
              </ul>
            </div>
            <div style={styles.divider} />
            <div style={styles.cardInner}>
              <h3 style={{ ...styles.cardTitle, fontSize: 16, marginTop: 0 }}>{openHoursTitle}</h3>
              <ul style={styles.list}>
                {openHoursLines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* ASSISTENZA */}
          <div style={styles.card}>
            <div style={{ ...styles.cardInner, paddingBottom: 10 }}>
              <div style={styles.helpTop}>
                <div>
                  <h2 style={styles.cardTitle}>
                    Assistenza <span aria-hidden>💬</span>
                  </h2>
                  <div style={styles.cardSub}>
                    Domande su servizi, orari o info generali. Per prenotare usa sempre il box “Prenota adesso”.
                  </div>
                </div>

                <button style={styles.helpBtn} onClick={() => setShowHelp((v) => !v)}>
                  {showHelp ? "Nascondi" : "Apri chat"}
                </button>
              </div>
            </div>

            {showHelp ? (
              <>
                <div style={styles.divider} />
                <div style={styles.cardInner}>
                  <ChatBox />
                </div>
              </>
            ) : (
              <div style={{ ...styles.cardInner, paddingTop: 0 }}>
                <div style={{ ...styles.cardSub, marginTop: 0 }}>
                  Premi <b>“Apri chat”</b> se ti serve aiuto.
                </div>
              </div>
            )}
          </div>

          {/* PRENOTA */}
          <div ref={refBook} style={styles.card}>
            <div style={styles.cardInner}>
              <h2 style={styles.cardTitle}>Prenota adesso ✅</h2>
              <div style={styles.cardSub}>
                Ti mostriamo <b>solo gli orari disponibili</b> per la data scelta.
              </div>
            </div>
            <div style={styles.divider} />
            <div style={styles.cardInner}>
              <FastBookingForm />
            </div>
          </div>

          {/* ANNULLA */}
          <div ref={refCancel} style={styles.card}>
            <div style={styles.cardInner}>
              <h2 style={styles.cardTitle}>Annulla prenotazione ✖️</h2>
              <div style={styles.cardSub}>
                Usa lo stesso <b>telefono</b> e la stessa <b>data + ora</b> della prenotazione.
              </div>
            </div>
            <div style={styles.divider} />
            <div style={styles.cardInner}>
              <CancelBookingForm />
            </div>
          </div>
        </section>

        <footer style={styles.footer}>Powered by GalaxBot AI</footer>
      </div>

      {/* ✅ Mobile: bottoni comodi + titolo che scala */}
      <style>{`
        @media (max-width: 520px) {
          h1 { font-size: 34px !important; }
        }
        @media (max-width: 480px) {
          button { width: 100%; }
        }
      `}</style>
    </main>
  );
}