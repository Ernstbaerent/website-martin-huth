/**
 * Terminanfrage: Formular prüfen und die fertige E-Mail im E-Mail-Programm öffnen.
 *
 * Datenschutz: Diese Datei speichert NICHTS (kein localStorage, keine Cookies) und
 * überträgt NICHTS an einen Server. Sie baut nur einen mailto:-Link; abgeschickt wird
 * die E-Mail erst, wenn die Besucherin oder der Besucher im eigenen E-Mail-Programm
 * auf „Senden“ klickt.
 *
 * Austauschbarer Versand: Alles, was mit dem Verschicken zu tun hat, steckt im Objekt
 * `mailtoVersand`. Ein späterer Server-Dienst bekommt dieselbe Form
 * ({ async senden(anfrage) → { meldung } }) und wird bei richteAnfrageEin() übergeben.
 */
import { datumKurz } from './kalender.js';

export const EMPFAENGER = 'martin.huth@it-profis.biz';

/* ------------------------------------------------------------------ Texte der E-Mail */

/** „Terminanfrage: Dienstag, 03.11.2026 – Organisation“ */
export function baueBetreff(anfrage) {
  return `Terminanfrage: ${datumKurz(anfrage.datum)} – ${anfrage.organisation}`;
}

/** Übersichtlicher Mailtext mit allen Formulardaten. */
export function baueText(anfrage) {
  return [
    'Guten Tag Herr Dr. Huth,',
    '',
    'hiermit frage ich unverbindlich einen Termin an.',
    '',
    `Wunschtermin:  ${datumKurz(anfrage.datum)}`,
    `Name:          ${anfrage.name}`,
    `Organisation:  ${anfrage.organisation}`,
    `E-Mail:        ${anfrage.email}`,
    `Telefon:       ${anfrage.telefon || '–'}`,
    '',
    'Anliegen:',
    anfrage.anliegen,
    '',
    'Mit freundlichen Grüßen',
    anfrage.name,
  ].join('\r\n');
}

/** Vollständiger mailto:-Link (Zeilenumbrüche als CRLF, alles sauber kodiert). */
export function baueMailto(anfrage, empfaenger = EMPFAENGER) {
  const betreff = encodeURIComponent(baueBetreff(anfrage));
  const text = encodeURIComponent(baueText(anfrage));
  return `mailto:${empfaenger}?subject=${betreff}&body=${text}`;
}

/* ------------------------------------------------------------------ Versand (austauschbar) */

export const mailtoVersand = {
  async senden(anfrage) {
    window.location.href = baueMailto(anfrage);
    return {
      meldung: 'Ihr E-Mail-Programm öffnet sich mit der fertigen Anfrage. '
        + 'Bitte prüfen Sie die Nachricht und klicken Sie dort auf „Senden“ – erst dann ist sie verschickt.',
    };
  },
};

/* ------------------------------------------------------------------ Prüfung */

const MUSTER_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Prüft die Eingaben. Gibt ein Objekt Feldname → Fehlermeldung zurück (leer = alles in Ordnung).
 * Reihenfolge entspricht der Reihenfolge im Formular.
 */
export function pruefe(anfrage) {
  const fehler = {};
  if (!anfrage.name) fehler.name = 'Bitte geben Sie Ihren Namen an.';
  if (!anfrage.organisation) fehler.organisation = 'Bitte geben Sie Ihre Organisation an.';
  if (!anfrage.email) fehler.email = 'Bitte geben Sie Ihre E-Mail-Adresse an.';
  else if (!MUSTER_EMAIL.test(anfrage.email)) fehler.email = 'Bitte prüfen Sie die E-Mail-Adresse, z. B. name@beispiel.de.';
  if (!anfrage.anliegen) fehler.anliegen = 'Bitte beschreiben Sie kurz Ihr Anliegen.';
  return fehler;
}

/* ------------------------------------------------------------------ Formular im Browser */

/**
 * Verbindet das Formular auf der Seite mit der Logik.
 * @param {object} teile
 * @param {HTMLElement} teile.bereich   – Container des Formulars (anfangs hidden)
 * @param {HTMLElement} [teile.vorher]  – Hinweis, der vor der Tagesauswahl sichtbar ist
 * @param {{senden: Function}} [teile.versand=mailtoVersand]
 * @returns {{zeigeFuer: (datum: Date) => void}}
 */
export function richteAnfrageEin({ bereich, vorher, versand = mailtoVersand }) {
  const formular = bereich.querySelector('form');
  const titel = bereich.querySelector('[data-anfrage-titel]');
  const knopf = bereich.querySelector('[data-anfrage-senden]');
  const status = bereich.querySelector('[data-anfrage-status]');
  let datum = null;

  const felder = ['name', 'organisation', 'email', 'telefon', 'anliegen'];
  const feld = (name) => formular.elements.namedItem(name);

  function lese() {
    const werte = Object.fromEntries(felder.map((n) => [n, feld(n).value.trim()]));
    return { datum, ...werte };
  }

  function zeigeFehler(fehler) {
    for (const name of felder) {
      const eingabe = feld(name);
      const meldung = document.getElementById(`${eingabe.id}-fehler`);
      if (!meldung) continue;
      if (fehler[name]) {
        eingabe.setAttribute('aria-invalid', 'true');
        meldung.textContent = fehler[name];
        meldung.hidden = false;
      } else {
        eingabe.removeAttribute('aria-invalid');
        meldung.textContent = '';
        meldung.hidden = true;
      }
    }
  }

  // Fehlermeldung verschwindet, sobald das Feld korrigiert wird
  formular.addEventListener('input', (ereignis) => {
    const eingabe = ereignis.target;
    if (eingabe.getAttribute('aria-invalid') !== 'true' || pruefe(lese())[eingabe.name]) return;
    eingabe.removeAttribute('aria-invalid');
    const meldung = document.getElementById(`${eingabe.id}-fehler`);
    if (meldung) { meldung.textContent = ''; meldung.hidden = true; }
  });

  formular.addEventListener('submit', async (ereignis) => {
    ereignis.preventDefault();
    status.textContent = '';
    const anfrage = lese();
    const fehler = pruefe(anfrage);
    zeigeFehler(fehler);
    const erster = felder.find((n) => fehler[n]);
    if (erster) {
      feld(erster).focus();
      return;
    }
    try {
      const ergebnis = await versand.senden(anfrage);
      status.textContent = ergebnis.meldung;
    } catch {
      status.textContent = `Die Anfrage konnte nicht vorbereitet werden. Bitte schreiben Sie direkt an ${EMPFAENGER}.`;
    }
  });

  return {
    zeigeFuer(neuesDatum) {
      datum = neuesDatum;
      const text = datumKurz(datum);
      titel.textContent = `Ihre Anfrage für ${text}`;
      knopf.textContent = `Anfrage für ${text} senden`;
      status.textContent = '';
      if (vorher) vorher.hidden = true;
      const warVerborgen = bereich.hidden;
      bereich.hidden = false;
      if (warVerborgen) {
        // Beim ersten Mal zum Formular springen, damit klar ist, wie es weitergeht
        const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        bereich.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'nearest' });
      }
    },
  };
}

/* ------------------------------------------------------------------ Kopier-Knopf */

/** Kopiert die E-Mail-Adresse; falls die Zwischenablage gesperrt ist, wird die Adresse markiert. */
export function richteKopierknopfEin(knopf, quelle, meldung) {
  knopf.addEventListener('click', async () => {
    const text = quelle.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      meldung.textContent = 'Adresse kopiert.';
    } catch {
      const auswahl = window.getSelection();
      const bereich = document.createRange();
      bereich.selectNodeContents(quelle);
      auswahl.removeAllRanges();
      auswahl.addRange(bereich);
      meldung.textContent = 'Adresse markiert – bitte mit Strg+C bzw. „Kopieren“ übernehmen.';
    }
    setTimeout(() => { meldung.textContent = ''; }, 4000);
  });
}
