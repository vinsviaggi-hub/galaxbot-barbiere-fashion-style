"use client";

import React, { useMemo, useState, type FormEvent } from "react";

function normalizePhoneForWa(raw: string) {
  // prende solo numeri e +, e converte 00 -> +
  return String(raw || "")
    .trim()
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+");
}

function waNumberOnly(raw: string) {
  // wa.me vuole solo numeri (senza +)
  return normalizePhoneForWa(raw).replace(/\+/g, "").replace(/[^\d]/g, "");
}

function buildWhatsAppUrl(shopPhone: string, text: string) {
  const n = waNumberOnly(shopPhone);
  const t = encodeURIComponent(text);
  return `https://wa.me/${n}?text=${t}`;
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function toItDate(iso: string) {
  const s = String(iso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

type Props = {
  // opzionale: se vuoi passarlo da page.tsx
  shopWhatsApp?: string; // es: "+393331234567"
  businessName?: string; // es: "4 Zampe"
};

export default function CancelBookingForm({ shopWhatsApp, businessName = "4 Zampe" }: Props) {
  const SHOP_WA =
    shopWhatsApp ||
    (process.env.NEXT_PUBLIC_SHOP_WHATSAPP ?? "").trim() ||
    "+393331234567"; // fallback (cambialo se serve)

  const [ownerName, setOwnerName] = useState("");
  const [dogName, setDogName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(""); // YYYY-MM-DD (da input date)
  const [time, setTime] = useState(""); // HH:mm (da input time)
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return (
      ownerName.trim().length >= 2 &&
      dogName.trim().length >= 1 &&
      normalizePhoneForWa(phone).length >= 8 &&
      date.trim().length > 0 &&
      time.trim().length > 0
    );
  }, [ownerName, dogName, phone, date, time]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!canSubmit) {
      setErr("Compila tutti i campi: nome padrone, nome cane, telefono, data e ora.");
      return;
    }

    setLoading(true);
    try {
      const owner = ownerName.trim();
      const dog = dogName.trim();
      const tel = normalizePhoneForWa(phone);
      const dIso = date.trim();
      const dIt = toItDate(dIso);
      const t = time.trim();

      const msg = [
        `Ciao ${businessName} 👋`,
        `Vorrei *chiedere l’annullamento* dell’appuntamento:`,
        ``,
        `• Cane: ${dog}`,
        `• Proprietario: ${owner}`,
        `• Telefono: ${tel}`,
        `• Data: ${dIt}`,
        `• Ora: ${t}`,
        ``,
        `Se non è possibile annullare, posso spostarlo ad un altro orario/giorno. Grazie!`,
      ].join("\n");

      const url = buildWhatsAppUrl(SHOP_WA, msg);

      // ✅ FIX “pagina bianca” su iPhone:
      // su mobile apri nella stessa scheda; su desktop puoi aprire in nuova tab
      if (isMobileDevice()) {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      setErr(String(e?.message || e || "Errore."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <h2 style={styles.title}>Chiedi annullamento</h2>
        <span style={styles.badge}>Richiesta</span>
      </div>

      <p style={styles.subtitle}>
        Invia una richiesta via WhatsApp con i dettagli. La toelettatura conferma l’annullamento o propone un altro orario.
      </p>

      <form onSubmit={onSubmit} style={styles.form}>
        <div style={styles.grid}>
          <label style={styles.label}>
            Nome del padrone <span style={styles.req}>*</span>
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Es. Marco"
              style={styles.input}
              autoComplete="name"
            />
          </label>

          <label style={styles.label}>
            Nome del cane <span style={styles.req}>*</span>
            <input value={dogName} onChange={(e) => setDogName(e.target.value)} placeholder="Es. Luna" style={styles.input} />
          </label>

          <label style={styles.label}>
            Telefono <span style={styles.req}>*</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Es. 333 123 4567"
              style={styles.input}
              inputMode="tel"
              autoComplete="tel"
            />
          </label>

          <label style={styles.label}>
            Data <span style={styles.req}>*</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
            <div style={styles.help}>Seleziona la stessa data dell’appuntamento.</div>
          </label>

          <label style={styles.label}>
            Ora (HH:mm) <span style={styles.req}>*</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={styles.input} />
            <div style={styles.help}>Qui i “:” ci sono sempre (es. 08:30).</div>
          </label>
        </div>

        {err ? <div style={styles.errorBox}>{err}</div> : null}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          style={{ ...styles.btn, opacity: !canSubmit || loading ? 0.7 : 1 }}
        >
          {loading ? "Apro WhatsApp..." : "Chiedi annullamento"}
        </button>

        <div style={styles.note}>
          Nota: questa è una <b>richiesta</b>. L’annullamento effettivo viene confermato dal negozio.
        </div>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    borderRadius: 18,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "linear-gradient(180deg, rgba(180,40,40,0.40) 0%, rgba(80,20,20,0.25) 100%)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    marginTop: 14,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: 0.2 },
  badge: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255, 90, 90, 0.22)",
    border: "1px solid rgba(255, 90, 90, 0.35)",
  },
  subtitle: { margin: "6px 0 14px 0", opacity: 0.9, lineHeight: 1.35 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 },
  req: { color: "rgba(255,170,170,1)", fontWeight: 900 },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.18)",
    outline: "none",
    background: "rgba(0,0,0,0.20)",
    color: "white",
    fontSize: 15,
  },
  help: { fontSize: 12, opacity: 0.8, fontWeight: 500 },
  errorBox: {
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255, 120, 120, 0.35)",
    background: "rgba(255, 90, 90, 0.18)",
    fontWeight: 700,
  },
  btn: {
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255, 120, 120, 0.35)",
    background: "linear-gradient(180deg, rgba(255,120,120,0.85) 0%, rgba(255,70,70,0.70) 100%)",
    color: "white",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  },
  note: { fontSize: 12, opacity: 0.85, lineHeight: 1.35 },
};