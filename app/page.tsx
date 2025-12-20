// app/page.tsx
"use client";

import React, { useMemo, useState, type FormEvent } from "react";
import ChatBox from "./components/chatbox";

type Status = "idle" | "loading" | "success" | "error";
type OrderType = "ASPORTO" | "CONSEGNA" | "TAVOLO";

export default function Page() {
  // === DATI (cliente) ===
  const BUSINESS_NAME = "Pala Pizza 🍕";
  const TAGLINE = "Pizzeria & Ristorante · Ordina o prenota in pochi secondi";
  const ADDRESS = "Via Roma 10, 00100 Roma (RM)";
  const PHONE = "+39 333 456 7890"; // numero casuale

  const HOURS = useMemo(
    () => [
      { day: "Lun–Gio", time: "12:00–15:00 · 18:00–23:00" },
      { day: "Ven–Sab", time: "12:00–15:00 · 18:00–00:00" },
      { day: "Dom", time: "18:00–23:00" },
    ],
    []
  );

  const mapsLink = useMemo(() => {
    const q = encodeURIComponent(`${BUSINESS_NAME}, ${ADDRESS}`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }, [BUSINESS_NAME, ADDRESS]);

  // === FORM ===
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string>("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<OrderType>("ASPORTO");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [order, setOrder] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const isDelivery = type === "CONSEGNA";
  const isTable = type === "TAVOLO";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!name.trim()) return setMsg("Scrivi il nome.");
    if (!phone.trim()) return setMsg("Scrivi un numero di telefono.");
    if (!date) return setMsg("Scegli una data.");
    if (!time) return setMsg("Scegli un orario.");

    if (isDelivery && !address.trim())
      return setMsg("Per la consegna serve l’indirizzo.");

    if (!order.trim()) {
      return setMsg(
        isTable
          ? "Scrivi: numero persone + preferenza (interno/esterno)."
          : "Scrivi cosa vuoi ordinare."
      );
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: name.trim(),
          telefono: phone.trim(),
          tipo: type,
          data: date,
          ora: time,
          ordine: order.trim(),
          indirizzo: isDelivery ? address.trim() : "",
          note: notes.trim(),
          botOrManuale: "WEBAPP",
          negozio: BUSINESS_NAME,
        }),
      });

      const dataRes = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("error");
        setMsg(dataRes?.error || "Errore durante l’invio. Riprova.");
        return;
      }

      setStatus("success");
      setMsg("Richiesta inviata ✅ Ti risponderemo il prima possibile.");

      setName("");
      setPhone("");
      setDate("");
      setTime("");
      setOrder("");
      setAddress("");
      setNotes("");

      setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setStatus("error");
      setMsg("Errore di rete. Controlla la connessione e riprova.");
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 text-zinc-900">
      {/* sfondo più “pizzeria”, vivace ma leggibile */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(1200px_700px_at_10%_0%,rgba(255,80,0,0.22),transparent_60%),radial-gradient(900px_700px_at_90%_0%,rgba(34,197,94,0.18),transparent_55%),radial-gradient(900px_700px_at_50%_90%,rgba(255,180,0,0.22),transparent_55%),linear-gradient(180deg,#fff7ed_0%,#fff_35%,#fff7ed_100%)]" />

      <div className="mx-auto max-w-6xl">
        {/* HERO */}
        <section className="rounded-3xl border border-black/10 bg-white/75 shadow-[0_16px_40px_rgba(0,0,0,0.12)] backdrop-blur p-5 sm:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {BUSINESS_NAME}
              </h1>

              <p className="mt-1 text-sm sm:text-base text-zinc-700">
                {TAGLINE}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-sm">
                  📍 <span className="truncate">{ADDRESS}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-sm">
                  ☎️ <span>{PHONE}</span>
                </span>
              </div>

              {/* ORARI A TENDINA */}
              <div className="mt-4">
                <details className="group inline-block">
                  <summary className="cursor-pointer select-none inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/85 px-4 py-2 text-sm font-extrabold hover:bg-white">
                    🕒 Orari di apertura
                    <span className="ml-1 transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </summary>

                  <div className="mt-2 w-full max-w-md rounded-2xl border border-black/10 bg-white/90 p-4 shadow-[0_14px_35px_rgba(0,0,0,0.14)]">
                    <div className="grid gap-2">
                      {HOURS.map((h) => (
                        <div
                          key={h.day}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white/80 border border-black/10 px-3 py-2"
                        >
                          <div className="font-extrabold">{h.day}</div>
                          <div className="text-zinc-800 font-semibold">
                            {h.time}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* CTA */}
            <div className="flex w-full flex-col gap-2 md:w-[280px]">
              <a
                href={`tel:${PHONE.replace(/\s+/g, "")}`}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-center font-extrabold text-white shadow hover:bg-emerald-700 active:scale-[0.99]"
              >
                Chiama ora
              </a>

              <a
                href={mapsLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-black/10 bg-white/85 px-4 py-3 text-center font-extrabold text-zinc-900 hover:bg-white active:scale-[0.99]"
              >
                Indicazioni
              </a>

              <div className="rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-xs text-zinc-700">
                Per ordini e prenotazioni, compila il modulo qui sotto.
              </div>
            </div>
          </div>

          {/* barra vivace */}
          <div className="mt-6 h-2 w-full rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-emerald-600" />
        </section>

        {/* CONTENUTO */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          {/* FORM */}
          <div className="rounded-3xl border border-black/10 bg-white/78 shadow-[0_16px_40px_rgba(0,0,0,0.12)] backdrop-blur p-5 sm:p-6">
            <h2 className="text-xl font-extrabold">Ordina / Prenota</h2>
            <p className="mt-1 text-sm text-zinc-700">
              Inserisci i dati e invia la richiesta.
            </p>

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/25"
                    placeholder="Es. Giuseppe"
                    autoComplete="name"
                  />
                </Field>

                <Field label="Telefono">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/25"
                    placeholder="Es. 327 950 3360"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </Field>
              </div>

              <Field label="Tipo">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as OrderType)}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/25"
                >
                  <option value="ASPORTO">Asporto</option>
                  <option value="CONSEGNA">Consegna</option>
                  <option value="TAVOLO">Tavolo</option>
                </select>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Data">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/25"
                  />
                </Field>

                <Field label="Ora">
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/25"
                  />
                </Field>
              </div>

              <Field label={isTable ? "Dettagli tavolo" : "Ordine"}>
                <textarea
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  className="min-h-[90px] w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/25"
                  placeholder={
                    isTable
                      ? "Es. 2 persone, interno (oppure 4 persone, esterno)"
                      : "Es. 2 margherite + 1 coca (se hai allergie scrivilo)"
                  }
                />
              </Field>

              {isDelivery && (
                <Field label="Indirizzo consegna">
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="min-h-[70px] w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/25"
                    placeholder="Via, numero, citofono, interno…"
                  />
                </Field>
              )}

              <Field label="Note (opzionale)">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/25"
                  placeholder="Es. senza glutine, no cipolla, ecc."
                />
              </Field>

              {!!msg && (
                <div
                  className={[
                    "rounded-xl border px-3 py-2 text-sm font-semibold",
                    status === "success"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900"
                      : status === "error"
                      ? "border-red-500/30 bg-red-500/10 text-red-900"
                      : "border-black/10 bg-white/70 text-zinc-900",
                  ].join(" ")}
                >
                  {msg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full rounded-xl bg-emerald-700 text-white px-4 py-3 font-extrabold shadow hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]"
              >
                {status === "loading" ? "Invio in corso…" : "Invia"}
              </button>
            </form>
          </div>

          {/* CHAT */}
          <div className="rounded-3xl border border-black/10 bg-white/78 shadow-[0_16px_40px_rgba(0,0,0,0.12)] backdrop-blur p-5 sm:p-6">
            <h2 className="text-xl font-extrabold">Chat assistente</h2>
            <p className="mt-1 text-sm text-zinc-700">
              Qui solo info: menu, senza glutine, allergeni, ingredienti, ecc. <br />
              Per ordini/prenotazioni usa il modulo a sinistra.
            </p>

            <div className="mt-4">
              <ChatBox />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-extrabold text-zinc-900">{label}</div>
      {children}
    </label>
  );
}