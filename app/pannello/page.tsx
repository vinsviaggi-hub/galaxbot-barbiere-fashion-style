"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./pannello.module.css";

type OrderRow = {
  id: string;
  timestamp: string;
  nome: string;
  telefono: string;
  tipo: string; // TAVOLO | ASPORTO | CONSEGNA
  dataISO: string; // YYYY-MM-DD
  ora: string; // HH:mm
  allergeni: string;
  ordine: string;
  indirizzo: string;
  stato: string; // NUOVO | CONFERMATO | ANNULLATO | CONSEGNATO
  canale: string; // APP | BOT | MANUALE
  note: string;
};

function s(v: any) {
  return v === null || v === undefined ? "" : String(v);
}

function normalizePhone(raw: string) {
  return s(raw).replace(/[^\d+]/g, "");
}

// ✅ prova a rendere "327..." -> "39..." (Italia) quando manca prefisso
function phoneForWhatsApp(raw: string) {
  let p = normalizePhone(raw).replace("+", "").trim();
  if (!p) return "";
  if (p.startsWith("00")) p = p.slice(2);

  // se non ha prefisso e sembra italiano (10 cifre), aggiungi 39
  if (!p.startsWith("39") && /^\d{10}$/.test(p)) p = `39${p}`;

  return p;
}

function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

// ✅ "12:30" ok, ISO "1899-12-30T..." -> "HH:mm"
function normalizeTime(value: any) {
  const str = s(value).trim();
  if (!str) return "";
  if (/^\d{2}:\d{2}$/.test(str)) return str;

  // prova a prendere HH:mm dentro una stringa più lunga
  const m = /(\d{1,2}):(\d{2})/.exec(str);
  if (m) return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;

  // prova parse date
  const d = new Date(str);
  if (Number.isFinite(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return str;
}

function toDateISO(value: any): string {
  const str = s(value).trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const mIt = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (mIt) return `${mIt[3]}-${mIt[2]}-${mIt[1]}`;

  const d = new Date(str);
  if (!Number.isFinite(d.getTime())) return str;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateIT(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function statusKey(raw: any) {
  const up = s(raw).trim().toUpperCase();
  if (up === "NUOVA") return "NUOVO";
  if (up === "CONFERMATA") return "CONFERMATO";
  if (up === "ANNULLATA") return "ANNULLATO";
  return up || "NUOVO";
}

function statusClass(stato: string) {
  const st = statusKey(stato);
  if (st === "CONFERMATO") return `${styles.badge} ${styles.badgeGreen}`;
  if (st === "CONSEGNATO") return `${styles.badge} ${styles.badgeYellow}`;
  if (st === "ANNULLATO") return `${styles.badge} ${styles.badgeRed}`;
  return `${styles.badge} ${styles.badgeBlue}`;
}

function typeClass(tipo: string) {
  const t = s(tipo).trim().toUpperCase();
  if (t === "CONSEGNA") return `${styles.badge} ${styles.badgeDeliver}`;
  if (t === "ASPORTO") return `${styles.badge} ${styles.badgeTake}`;
  return `${styles.badge} ${styles.badgeTable}`;
}

function pick(objOrArr: any, idx: number, keys: string[]) {
  if (Array.isArray(objOrArr)) return objOrArr[idx];
  const o = objOrArr || {};
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
    const low = k.toLowerCase();
    if (o[low] !== undefined && o[low] !== null) return o[low];
  }
  const map: Record<string, any> = {};
  for (const kk of Object.keys(o)) map[kk.toLowerCase()] = o[kk];
  for (const k of keys) {
    const v = map[k.toLowerCase()];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function buildStatusWaText(r: OrderRow, newStatus: "CONFERMATO" | "CONSEGNATO" | "ANNULLATO") {
  const base =
    `Ciao ${r.nome}! 👋\n` +
    `Ordine ${formatDateIT(r.dataISO)} ore ${r.ora}\n` +
    `Tipo: ${r.tipo}\n` +
    `Ordine: ${r.ordine}\n` +
    `${r.allergeni ? `Allergeni: ${r.allergeni}\n` : ""}` +
    `${r.indirizzo ? `Indirizzo: ${r.indirizzo}\n` : ""}`;

  if (newStatus === "CONFERMATO") {
    return `✅ CONFERMATO!\n${base}\nPerfetto, il tuo ordine è confermato. 🍕`;
  }
  if (newStatus === "CONSEGNATO") {
    return `🚚 CONSEGNATO!\n${base}\nGrazie! Buon appetito 😄`;
  }
  return `❌ ANNULLATO\n${base}\nPurtroppo non riusciamo a gestire l’ordine ora.`;
}

function buildWhatsAppUrl(phoneRaw: string, text: string) {
  const phone = phoneForWhatsApp(phoneRaw);
  if (!phone) return "";

  // ✅ mobile: deep link (apre app)
  if (isMobileUA()) {
    return `whatsapp://send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`;
  }

  // ✅ desktop: web
  const url = new URL("https://web.whatsapp.com/send");
  url.searchParams.set("phone", phone);
  url.searchParams.set("text", text);
  return url.toString();
}

function openWhatsAppAndReturn(waUrl: string) {
  if (!waUrl) return;
  const returnUrl = window.location.href;

  if (isMobileUA()) {
    // Vai su WhatsApp, poi quando torni al browser ti ritrovi già sul pannello
    window.location.href = waUrl;
    setTimeout(() => {
      window.location.href = returnUrl;
    }, 900);
    return;
  }

  const w = window.open(waUrl, "_blank", "noreferrer");
  if (!w) window.location.href = waUrl;
}

export default function PannelloOrdiniPalaPizza() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [updatingId, setUpdatingId] = useState<string>("");

  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"TUTTI" | "TAVOLO" | "ASPORTO" | "CONSEGNA">("TUTTI");
  const [stato, setStato] = useState<"TUTTI" | "NUOVO" | "CONFERMATO" | "ANNULLATO" | "CONSEGNATO">("TUTTI");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const r = await fetch("/api/admin/bookings", { method: "GET", cache: "no-store" });

      if (r.status === 401) {
        window.location.href = "/pannello/login";
        return;
      }

      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        setErr(data?.error || "Errore caricando ordini.");
        setRows([]);
        return;
      }

      const list: any[] = Array.isArray(data.rows) ? data.rows : [];

      const parsed: OrderRow[] = list.map((item: any, idx: number) => {
        const dataISO = toDateISO(pick(item, 4, ["Data", "date", "dataISO", "dataIso", "data"]));
        const id = s(pick(item, 12, ["ID", "id"])).trim();

        return {
          id: id || `fallback-${s(pick(item, 0, ["Timestamp", "timestamp"]))}-${idx}`,
          timestamp: s(pick(item, 0, ["Timestamp", "timestamp"])).trim(),
          nome: s(pick(item, 1, ["Nome", "name", "nome"])).trim(),
          telefono: s(pick(item, 2, ["Telefono", "phone", "telefono"])).trim(),
          tipo: s(pick(item, 3, ["Tipo", "type", "tipo"])).trim().toUpperCase() || "TAVOLO",
          dataISO,
          ora: normalizeTime(pick(item, 5, ["Ora", "time", "ora"])),
          allergeni: s(pick(item, 6, ["Allergeni", "allergens", "allergeni"])).trim(),
          ordine: s(pick(item, 7, ["Ordine", "order", "ordine"])).trim(),
          indirizzo: s(pick(item, 8, ["Indirizzo", "address", "indirizzo"])).trim(),
          stato: statusKey(pick(item, 9, ["Stato", "status", "stato"])),
          canale: s(pick(item, 10, ["Bot o Manuale", "canale", "source"])).trim().toUpperCase(),
          note: s(pick(item, 11, ["Note", "note"])).trim(),
        };
      });

      parsed.sort((a, b) => {
        const da = `${a.dataISO} ${a.ora}`.trim();
        const db = `${b.dataISO} ${b.ora}`.trim();
        if (da < db) return -1;
        if (da > db) return 1;
        return (a.timestamp || "").localeCompare(b.timestamp || "");
      });

      setRows(parsed);
    } catch (e: any) {
      setErr(e?.message || "Errore rete.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/pannello/login";
  }

  async function setStatus(id: string, newStatus: "CONFERMATO" | "CONSEGNATO" | "ANNULLATO") {
    setErr("");
    if (!id) {
      setErr("ID mancante: controlla che lo script scriva la colonna ID.");
      return;
    }

    setUpdatingId(id);
    try {
      const r = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stato: newStatus }),
      });

      const j = await r.json().catch(() => null);

      if (r.status === 401) {
        window.location.href = "/pannello/login";
        return;
      }
      if (!r.ok || !j?.ok) {
        setErr(j?.error || "Errore aggiornando lo stato.");
        return;
      }

      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, stato: newStatus } : x)));
    } catch {
      setErr("Errore rete aggiornando lo stato.");
    } finally {
      setUpdatingId("");
    }
  }

  async function statusAndWhatsapp(r: OrderRow, newStatus: "CONFERMATO" | "CONSEGNATO" | "ANNULLATO") {
    const waText = buildStatusWaText(r, newStatus);
    const waHref = buildWhatsAppUrl(r.telefono, waText);

    // ✅ prima apri WhatsApp, poi aggiorna stato
    if (waHref) openWhatsAppAndReturn(waHref);
    await setStatus(r.id, newStatus);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ quando torni dalla app WhatsApp al browser, ricarica gli ordini
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c = { TOT: rows.length, NUOVO: 0, CONFERMATO: 0, ANNULLATO: 0, CONSEGNATO: 0 };
    for (const r of rows) {
      const st = statusKey(r.stato);
      if (st === "NUOVO") c.NUOVO++;
      else if (st === "CONFERMATO") c.CONFERMATO++;
      else if (st === "ANNULLATO") c.ANNULLATO++;
      else if (st === "CONSEGNATO") c.CONSEGNATO++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tipo !== "TUTTI" && r.tipo !== tipo) return false;

      const st = statusKey(r.stato);
      if (stato !== "TUTTI" && st !== stato) return false;

      if (from && r.dataISO && r.dataISO < from) return false;
      if (to && r.dataISO && r.dataISO > to) return false;

      if (!qq) return true;
      const blob = [
        r.nome,
        r.telefono,
        r.tipo,
        r.dataISO,
        r.ora,
        r.ordine,
        r.allergeni,
        r.indirizzo,
        r.stato,
        r.canale,
        r.note,
        r.id,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(qq);
    });
  }, [rows, q, tipo, stato, from, to]);

  const busyStyle = (id: string): CSSProperties =>
    updatingId === id ? { opacity: 0.6, pointerEvents: "none" } : {};

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.top}>
              <div className={styles.brand}>
                <div className={styles.logo} aria-hidden>
                  🍕
                </div>
                <div>
                  <h1 className={styles.h1}>Pannello Ordini · Pala Pizza</h1>
                  <p className={styles.sub}>Aggiorna stato + WhatsApp pronto (PC + telefono).</p>
                </div>
              </div>

              <div className={styles.actionsTop}>
                <button className={styles.btn} onClick={load} disabled={loading}>
                  {loading ? "Aggiorno…" : "Aggiorna"}
                </button>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={logout}>
                  Esci
                </button>
              </div>
            </div>

            <div className={styles.metrics}>
              <div className={styles.card}>
                <div className={styles.cardLabel}>Totali</div>
                <div className={styles.cardValue}>{counts.TOT}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardLabel}>Nuovi</div>
                <div className={styles.cardValue}>{counts.NUOVO}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardLabel}>Confermati</div>
                <div className={styles.cardValue}>{counts.CONFERMATO}</div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardLabel}>Consegnati</div>
                <div className={styles.cardValue}>{counts.CONSEGNATO}</div>
              </div>
            </div>

            <div className={styles.tools}>
              <div className={styles.search}>
                <input
                  className={styles.input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cerca: nome, telefono, ordine, indirizzo, note…"
                />
              </div>

              <div className={styles.selects}>
                <select className={styles.select} value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
                  <option value="TUTTI">Tutti i tipi</option>
                  <option value="TAVOLO">Tavolo</option>
                  <option value="ASPORTO">Asporto</option>
                  <option value="CONSEGNA">Consegna</option>
                </select>

                <select className={styles.select} value={stato} onChange={(e) => setStato(e.target.value as any)}>
                  <option value="TUTTI">Tutti gli stati</option>
                  <option value="NUOVO">Nuovo</option>
                  <option value="CONFERMATO">Confermato</option>
                  <option value="CONSEGNATO">Consegnato</option>
                  <option value="ANNULLATO">Annullato</option>
                </select>
              </div>

              <div className={styles.range}>
                <span className={styles.small}>Da</span>
                <input className={styles.date} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span className={styles.small}>A</span>
                <input className={styles.date} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>

              <button
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => {
                  setQ("");
                  setTipo("TUTTI");
                  setStato("TUTTI");
                  setFrom("");
                  setTo("");
                }}
              >
                Reset
              </button>

              <div className={styles.counter}>
                {filtered.length}/{rows.length}
              </div>
            </div>
          </div>
        </header>

        {err ? <div className={styles.error}>⚠️ {err}</div> : null}

        <div className={styles.tableWrap} aria-busy={loading ? "true" : "false"}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ora</th>
                <th>Nome</th>
                <th>Telefono</th>
                <th>Tipo</th>
                <th>Ordine</th>
                <th>Allergeni</th>
                <th>Indirizzo</th>
                <th>Stato</th>
                <th>Canale</th>
                <th>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className={styles.tdEmpty}>
                    Caricamento…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className={styles.tdEmpty}>
                    Nessun risultato.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const phone = normalizePhone(r.telefono);
                  const telHref = phone ? `tel:${phone}` : undefined;

                  return (
                    <tr key={`${r.id}-${i}`} className={styles.row} style={busyStyle(r.id)}>
                      <td className={styles.mono}>{formatDateIT(r.dataISO)}</td>
                      <td className={styles.mono}>{r.ora || "—"}</td>
                      <td className={styles.name}>{r.nome || "—"}</td>
                      <td className={styles.mono}>{r.telefono || "—"}</td>
                      <td>
                        <span className={typeClass(r.tipo)}>{r.tipo}</span>
                      </td>
                      <td className={styles.order}>{r.ordine || "—"}</td>
                      <td className={styles.allergeni}>{r.allergeni || "—"}</td>
                      <td className={styles.addr}>{r.indirizzo || "—"}</td>
                      <td>
                        <span className={statusClass(r.stato)}>{statusKey(r.stato)}</span>
                      </td>
                      <td className={styles.mono}>{r.canale || "—"}</td>
                      <td>
                        <div className={styles.actions}>
                          {telHref ? (
                            <a className={`${styles.actionBtn} ${styles.actionCall}`} href={telHref}>
                              📞 Chiama
                            </a>
                          ) : null}

                          <button
                            className={`${styles.actionBtn} ${styles.actionOk}`}
                            onClick={() => statusAndWhatsapp(r, "CONFERMATO")}
                            disabled={updatingId === r.id}
                            type="button"
                          >
                            ✅ Conferma
                          </button>

                          <button
                            className={`${styles.actionBtn} ${styles.actionDone}`}
                            onClick={() => statusAndWhatsapp(r, "CONSEGNATO")}
                            disabled={updatingId === r.id}
                            type="button"
                          >
                            🚚 Consegnato
                          </button>

                          <button
                            className={`${styles.actionBtn} ${styles.actionNo}`}
                            onClick={() => statusAndWhatsapp(r, "ANNULLATO")}
                            disabled={updatingId === r.id}
                            type="button"
                          >
                            ❌ Annulla
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.mobileCards}>
          {loading ? (
            <div className={styles.mCard}>Caricamento…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.mCard}>Nessun risultato.</div>
          ) : (
            filtered.map((r, i) => {
              const phone = normalizePhone(r.telefono);
              const telHref = phone ? `tel:${phone}` : undefined;

              return (
                <div key={`${r.id}-m-${i}`} className={styles.mCard} style={busyStyle(r.id)}>
                  <div className={styles.mTop}>
                    <div>
                      <div className={styles.mName}>{r.nome || "—"}</div>
                      <div className={styles.mSub}>
                        <span className={styles.mono}>{formatDateIT(r.dataISO)}</span> •{" "}
                        <b className={styles.mono}>{r.ora || "—"}</b> •{" "}
                        <span className={styles.mono}>{r.telefono || "—"}</span>
                      </div>
                    </div>
                    <div className={styles.mBadges}>
                      <span className={statusClass(r.stato)}>{statusKey(r.stato)}</span>
                      <span className={typeClass(r.tipo)}>{r.tipo}</span>
                    </div>
                  </div>

                  <div className={styles.mGrid}>
                    <div className={styles.mBox}>
                      <div className={styles.mLabel}>Ordine</div>
                      <div className={styles.mValue}>{r.ordine || "—"}</div>
                    </div>
                    <div className={styles.mBox}>
                      <div className={styles.mLabel}>Allergeni</div>
                      <div className={styles.mValue}>{r.allergeni || "—"}</div>
                    </div>
                    <div className={styles.mBox} style={{ gridColumn: "1 / -1" }}>
                      <div className={styles.mLabel}>Indirizzo</div>
                      <div className={styles.mValue}>{r.indirizzo || "—"}</div>
                    </div>
                    <div className={styles.mBox} style={{ gridColumn: "1 / -1" }}>
                      <div className={styles.mLabel}>Note</div>
                      <div className={styles.mValue}>{r.note || "—"}</div>
                    </div>
                  </div>

                  <div className={styles.actions} style={{ marginTop: 12 }}>
                    {telHref ? (
                      <a className={`${styles.actionBtn} ${styles.actionCall}`} href={telHref}>
                        📞 Chiama
                      </a>
                    ) : null}

                    <button
                      className={`${styles.actionBtn} ${styles.actionOk}`}
                      onClick={() => statusAndWhatsapp(r, "CONFERMATO")}
                      disabled={updatingId === r.id}
                      type="button"
                    >
                      ✅ Conferma
                    </button>

                    <button
                      className={`${styles.actionBtn} ${styles.actionDone}`}
                      onClick={() => statusAndWhatsapp(r, "CONSEGNATO")}
                      disabled={updatingId === r.id}
                      type="button"
                    >
                      🚚 Consegnato
                    </button>

                    <button
                      className={`${styles.actionBtn} ${styles.actionNo}`}
                      onClick={() => statusAndWhatsapp(r, "ANNULLATO")}
                      disabled={updatingId === r.id}
                      type="button"
                    >
                      ❌ Annulla
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}