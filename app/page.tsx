"use client";

import React, { useMemo, useState } from "react";
import styles from "./page.module.css";
import ChatBox from "./components/chatbox";

type Tipo = "TAVOLO" | "ASPORTO" | "CONSEGNA";

export default function Home() {
  const [nome, setNome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipo, setTipo] = useState<Tipo>("ASPORTO");
  const [data, setData] = useState("");
  const [ora, setOra] = useState("");
  const [allergeni, setAllergeni] = useState("");
  const [ordine, setOrdine] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [note, setNote] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [err, setErr] = useState("");

  const isConsegna = tipo === "CONSEGNA";

  const canSubmit = useMemo(() => {
    if (!nome.trim()) return false;
    if (!telefono.trim()) return false;
    if (!data.trim()) return false;
    if (!ora.trim()) return false;
    if (!ordine.trim()) return false;
    if (isConsegna && !indirizzo.trim()) return false;
    return true;
  }, [nome, telefono, data, ora, ordine, indirizzo, isConsegna]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOkMsg("");

    if (!canSubmit) {
      setErr("Compila i campi obbligatori.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        nome: nome.trim(),
        telefono: telefono.trim(),
        tipo,
        data,
        ora,
        allergeni: allergeni.trim(),
        ordine: ordine.trim(),
        indirizzo: isConsegna ? indirizzo.trim() : "",
        note: note.trim(),
        canale: "APP",
        honeypot,
      };

      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await r.json().catch(() => null);

      if (!r.ok) {
        setErr(j?.error || "Errore invio ordine. Riprova.");
        return;
      }

      setOkMsg("✅ Ordine inviato! La pizzeria ti conferma su WhatsApp/telefono.");
      setOrdine("");
      setAllergeni("");
      setNote("");
      if (!isConsegna) setIndirizzo("");
    } catch {
      setErr("Errore rete. Controlla connessione e riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logo} aria-hidden>
              🍕
            </div>
            <div>
              <h1 className={styles.h1}>Pala Pizza</h1>
              <p className={styles.sub}>Ordina in 30 secondi. Ricevi conferma via WhatsApp/telefono.</p>
            </div>
          </div>

          {/* ✅ NIENTE "Area staff" qui: il pannello è SOLO con link segreto */}
        </header>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Invia ordine</div>
          <div className={styles.cardSub}>
            Campi obbligatori: nome, telefono, tipo, data, ora, ordine (e indirizzo se consegna).
          </div>

          {err ? <div className={styles.error}>⚠️ {err}</div> : null}
          {okMsg ? <div className={styles.success}>{okMsg}</div> : null}

          <form className={styles.form} onSubmit={submit} autoComplete="off">
            {/* honeypot anti-bot */}
            <input
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className={styles.honeypot}
              tabIndex={-1}
              aria-hidden="true"
            />

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Nome *</label>
                <input
                  className={styles.input}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Es. Gennaro"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Telefono *</label>
                <input
                  className={styles.input}
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Es. 327..."
                  inputMode="tel"
                />
              </div>
            </div>

            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>Tipo *</label>
                <select className={styles.select} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
                  <option value="ASPORTO">Asporto</option>
                  <option value="TAVOLO">Tavolo</option>
                  <option value="CONSEGNA">Consegna</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Data *</label>
                <input className={styles.input} type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Ora *</label>
                <input className={styles.input} type="time" value={ora} onChange={(e) => setOra(e.target.value)} />
              </div>
            </div>

            {isConsegna ? (
              <div className={styles.field}>
                <label className={styles.label}>Indirizzo *</label>
                <input
                  className={styles.input}
                  value={indirizzo}
                  onChange={(e) => setIndirizzo(e.target.value)}
                  placeholder="Via, numero, citofono…"
                />
              </div>
            ) : null}

            <div className={styles.field}>
              <label className={styles.label}>Ordine *</label>
              <textarea
                className={styles.textarea}
                value={ordine}
                onChange={(e) => setOrdine(e.target.value)}
                placeholder="Es. 2 Margherite + 1 Diavola + 1 Coca Cola…"
              />
              <div className={styles.tip}>Tip: scrivi anche impasto/taglia, bibite, e se hai un orario preferito.</div>
            </div>

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label}>Allergeni</label>
                <input
                  className={styles.input}
                  value={allergeni}
                  onChange={(e) => setAllergeni(e.target.value)}
                  placeholder="Es. lattosio, glutine…"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Note</label>
                <input
                  className={styles.input}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Es. senza cipolla, ben cotta…"
                />
              </div>
            </div>

            <button className={styles.btn} type="submit" disabled={loading || !canSubmit}>
              {loading ? "Invio…" : "Invia ordine"}
            </button>

            <div className={styles.footerHint}>
              Dopo l’invio, la pizzeria vede l’ordine nel pannello e ti conferma su WhatsApp/telefono.
            </div>
          </form>
        </div>

        {/* ✅ BOT */}
        <section className={styles.botSection}>
          <div className={styles.botTitle}>Hai dubbi? Chiedi al bot 🍕</div>
          <div className={styles.botSub}>Orari, consegna/asporto, allergeni, come scrivere l’ordine.</div>
          <div className={styles.botBox}>
            <ChatBox />
          </div>
        </section>

        {/* ✅ Footer demo tolto: niente badge/scritte sotto */}
      </div>
    </div>
  );
}
