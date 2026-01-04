// app/config/business.ts

export type FeatureFlags = {
  enableBookings?: boolean;
  enableOrders?: boolean;
  enableOpenAIChat?: boolean;
};

export type WhatsAppTemplates = {
  confirmBooking?: string; // {name} {date} {time} {service}
  cancelBooking?: string; // {name} {date} {time} {service}
  genericHello?: string; // {name}
};

export type BotTexts = {
  greeting?: string;
  bookingGuide?: string;
  cancelGuide?: string;
  fallback?: string;
};

export type PwaConfig = {
  name?: string;
  shortName?: string;
  description?: string;
  themeColor?: string;
};

export type ThemeConfig = {
  primary?: string; // main accent
  danger?: string; // rosso/arancio annulla
  accent?: string; // secondario
  background?: string; // opzionale
};

export type CtaLabels = {
  book?: string;
  cancel?: string;
  help?: string;
  openChat?: string;
  closeChat?: string;
};

export type BusinessConfig = {
  slug: string;

  badgeTop: string;
  headline: string;
  subheadline: string;

  servicesShort: string;
  city: string;
  phone: string;

  servicesList?: string[];

  hoursTitle?: string;
  hoursLines?: string[];

  cta?: CtaLabels;
  footerText?: string;
  heroEmoji?: string;
  helpCardTitle?: string;
  helpCardSubtitle?: string;

  address?: string;
  whatsappPhone?: string;
  mapsUrl?: string;
  instagramUrl?: string;

  whatsappTemplates?: WhatsAppTemplates;
  bot?: BotTexts;
  pwa?: PwaConfig;
  features?: FeatureFlags;
  theme?: ThemeConfig;
};

const BUSINESS: BusinessConfig = {
  // ✅ slug unico per questo negozio/progetto
  slug: "barbiere-fashion-style",

  // ✅ testata
  badgeTop: "GALAXBOT AI · BARBER SHOP",
  headline: "Fashion Style",
  heroEmoji: "💈",
  subheadline: "Prenota il tuo taglio in pochi secondi. Conferma e gestione semplice delle prenotazioni.",

  // ✅ servizi
  servicesShort: "Taglio uomo, Barba, Taglio + barba, Sfumatura, Bimbo, Styling",
  servicesList: ["Taglio uomo", "Barba", "Taglio + barba", "Sfumatura", "Bimbo", "Styling"],

  // ✅ contatti (CAMBIA QUESTI)
  city: "Castelnuovo Vomano (TE)",
  phone: "333 123 4567",

  // ✅ orari (CAMBIA QUESTI)
  hoursTitle: "Orari di apertura",
  hoursLines: ["Lunedì–Sabato: 08:30–12:30 e 15:00–20:00", "Domenica: chiuso"],

  // ✅ bottoni
  cta: {
    book: "Prenota ora",
    cancel: "Annulla",
    help: "Assistenza",
    openChat: "Apri chat",
    closeChat: "Nascondi",
  },

  helpCardTitle: "Assistenza",
  helpCardSubtitle: "Domande su tagli, orari o servizi? Scrivi qui. Per prenotare usa sempre “Prenota adesso”.",

  footerText: "Powered by GalaxBot AI",

  // ✅ messaggi WhatsApp (usati nel pannello)
  whatsappTemplates: {
    genericHello: "Ciao {name}!",
    confirmBooking: "Ciao {name}! ✅ Prenotazione CONFERMATA per {date} alle {time} ({service}). A presto! 💈",
    cancelBooking:
      "Ciao {name}. ❌ La prenotazione {service} del {date} alle {time} è ANNULLATA. Se vuoi riprenotare, scrivimi qui. 💈",
  },

  // ✅ PWA (icona su Home)
  pwa: {
    name: "Fashion Style · Prenotazioni",
    shortName: "FashionStyle",
    description: "Prenota e gestisci appuntamenti",
    themeColor: "#0A0F18",
  },

  // ✅ funzioni attive
  features: {
    enableBookings: true,
    enableOrders: false,
    enableOpenAIChat: true,
  },

  // ✅ tema “barbiere” (puoi cambiare i colori se vuoi)
  theme: {
    primary: "#2563EB", // blu
    danger: "#EF4444", // rosso (annulla)
    accent: "#F59E0B", // oro (dettagli)
  },

  // facoltativi
  address: "",
  whatsappPhone: "",
  mapsUrl: "",
  instagramUrl: "",
};

export function getBusinessConfig(): BusinessConfig {
  return BUSINESS;
}