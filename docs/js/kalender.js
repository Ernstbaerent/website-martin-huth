/**
 * Verfügbarkeitskalender (Monatsansicht).
 *
 * Wird von der öffentlichen Seite und später von der Verwaltungsseite genutzt.
 * Der Kalender selbst speichert und sendet nichts – er zeigt nur an und meldet,
 * welcher Tag angeklickt wurde.
 *
 * Bedienung per Tastatur (wie im WAI-ARIA-Muster „Date Picker“):
 *   Pfeiltasten = Tag vor/zurück bzw. Woche vor/zurück, Pos1/Ende = Wochenanfang/-ende,
 *   Bild↑/Bild↓ = Monat zurück/vor, Eingabe oder Leertaste = Tag wählen.
 */
import { istFeiertag, datumsSchluessel } from './feiertage.js';

export { datumsSchluessel };

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember'];
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const SPALTEN = [1, 2, 3, 4, 5, 6, 0]; // Woche beginnt am Montag

/* ------------------------------------------------------------------ Datumshilfen */

/** Heutiges Datum, 00:00 Uhr lokal. */
export function heute() {
  const jetzt = new Date();
  return new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
}

/** „JJJJ-MM-TT“ → Date (lokal) oder null bei ungültiger Angabe. */
export function ausSchluessel(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [j, m, t] = text.split('-').map(Number);
  const datum = new Date(j, m - 1, t);
  return datum.getFullYear() === j && datum.getMonth() === m - 1 && datum.getDate() === t ? datum : null;
}

export function plusTage(datum, tage) {
  return new Date(datum.getFullYear(), datum.getMonth(), datum.getDate() + tage);
}

/** Gleicher Tag n Monate später; am Monatsende wird auf den letzten Tag gekürzt (31.01. → 28./29.02.). */
export function plusMonate(datum, monate) {
  const ziel = new Date(datum.getFullYear(), datum.getMonth() + monate, 1);
  const letzter = new Date(ziel.getFullYear(), ziel.getMonth() + 1, 0).getDate();
  return new Date(ziel.getFullYear(), ziel.getMonth(), Math.min(datum.getDate(), letzter));
}

function gleicherTag(a, b) {
  return a && b && datumsSchluessel(a) === datumsSchluessel(b);
}

/** „Dienstag, 3. November 2026“ */
export function datumLang(datum) {
  return `${WOCHENTAGE[datum.getDay()]}, ${datum.getDate()}. ${MONATE[datum.getMonth()]} ${datum.getFullYear()}`;
}

/** „Dienstag, 03.11.2026“ */
export function datumKurz(datum) {
  const t = String(datum.getDate()).padStart(2, '0');
  const m = String(datum.getMonth() + 1).padStart(2, '0');
  return `${WOCHENTAGE[datum.getDay()]}, ${t}.${m}.${datum.getFullYear()}`;
}

/* ------------------------------------------------------------------ Verfügbarkeitsdaten */

const MAX_TAGE_JE_EINTRAG = 400; // Schutz gegen versehentlich riesige Zeiträume

/**
 * Liest den Inhalt von data/verfuegbarkeit.json.
 * Format: { "nichtVerfuegbar": [ { "von": "2026-11-02", "bis": "2026-11-06" }, … ] }
 * Ungültige Einträge werden übersprungen.
 * @returns {{eintraege: {von: string, bis: string}[], gesperrt: Set<string>}}
 */
export function leseVerfuegbarkeit(daten) {
  const eintraege = [];
  const gesperrt = new Set();
  const liste = daten && Array.isArray(daten.nichtVerfuegbar) ? daten.nichtVerfuegbar : [];
  for (const roh of liste) {
    let von = ausSchluessel(roh && roh.von);
    let bis = ausSchluessel(roh && (roh.bis ?? roh.von));
    if (!von || !bis) continue;
    if (bis < von) [von, bis] = [bis, von];
    eintraege.push({ von: datumsSchluessel(von), bis: datumsSchluessel(bis) });
    for (let tag = von, n = 0; tag <= bis && n < MAX_TAGE_JE_EINTRAG; tag = plusTage(tag, 1), n++) {
      gesperrt.add(datumsSchluessel(tag));
    }
  }
  return { eintraege, gesperrt };
}

/**
 * Lädt data/verfuegbarkeit.json frisch vom Server (Cache-Busting).
 * Bei einem Fehler kommt ok: false und eine leere Liste zurück – der Kalender
 * funktioniert dann trotzdem mit Wochenenden und Feiertagen.
 */
export async function ladeVerfuegbarkeit(adresse = 'data/verfuegbarkeit.json') {
  try {
    const antwort = await fetch(`${adresse}?v=${Date.now()}`, { cache: 'no-store' });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    return { ok: true, ...leseVerfuegbarkeit(await antwort.json()) };
  } catch (fehler) {
    return { ok: false, eintraege: [], gesperrt: new Set(), fehler };
  }
}

/* ------------------------------------------------------------------ Status eines Tages */

/**
 * Warum ist ein Tag (nicht) verfügbar? Die Gründe sind nur für die Programmlogik –
 * die öffentliche Seite zeigt ausschließlich „verfügbar“ oder „nicht verfügbar“.
 * @returns {'vergangen'|'zu-weit'|'wochenende'|'feiertag'|'gesperrt'|'verfuegbar'}
 */
export function tagesStatus(datum, { heute: h, bis, gesperrt }) {
  if (datum < h) return 'vergangen';
  if (bis && datum > bis) return 'zu-weit';
  const wt = datum.getDay();
  if (wt === 0 || wt === 6) return 'wochenende';
  if (istFeiertag(datum)) return 'feiertag';
  if (gesperrt && gesperrt.has(datumsSchluessel(datum))) return 'gesperrt';
  return 'verfuegbar';
}

/* ------------------------------------------------------------------ Darstellung */

let zaehler = 0;

/**
 * Baut den Kalender in das Element `wurzel`.
 * @param {HTMLElement} wurzel
 * @param {object} optionen
 * @param {Date}   [optionen.heute]          – für Tests überschreibbar
 * @param {number} [optionen.monateVoraus=12]
 * @param {Set<string>} [optionen.gesperrt]  – Schlüssel „JJJJ-MM-TT“ aus verfuegbarkeit.json
 * @param {(status: string) => boolean} [optionen.waehlbar] – welche Tage anklickbar sind
 * @param {(status: string) => string}  [optionen.beschriftung] – Text für Bildschirmleser
 * @param {(datum: Date, status: string) => string} [optionen.zusatzKlasse] – z. B. Markierungen der Verwaltung
 * @param {(datum: Date, status: string) => void}   [optionen.beiAuswahl]
 * @param {number} [optionen.ueberschrift=3] – Ebene der Monatsüberschrift (h3 …)
 * @param {{klasse: string, text: string}[]} [optionen.legende]
 */
export function erstelleKalender(wurzel, optionen = {}) {
  const id = `kalender-${++zaehler}`;
  const o = {
    heute: heute(),
    monateVoraus: 12,
    gesperrt: new Set(),
    waehlbar: (status) => status === 'verfuegbar',
    beschriftung: (status) => (status === 'verfuegbar' ? 'verfügbar' : 'nicht verfügbar'),
    zusatzKlasse: () => '',
    beiAuswahl: () => {},
    ueberschrift: 3,
    legende: [
      { klasse: 'tag--verfuegbar', text: 'verfügbar' },
      { klasse: 'tag--gesperrt', text: 'nicht verfügbar' },
      { klasse: 'tag--gewaehlt', text: 'Ihre Auswahl' },
    ],
    ...optionen,
  };
  const ersterTag = o.heute;
  const letzterTag = plusMonate(o.heute, o.monateVoraus);

  let monat = new Date(ersterTag.getFullYear(), ersterTag.getMonth(), 1); // angezeigter Monat
  let fokus = null;      // Tag, der per Tab erreichbar ist (Roving Tabindex)
  let gewaehlt = null;   // ausgewählter Tag

  /* Grundgerüst */
  const h = `h${o.ueberschrift}`;
  wurzel.innerHTML = `
    <div class="kalender">
      <div class="kalender__kopf">
        <button type="button" class="kalender__blaettern" data-richtung="-1" aria-label="Vorheriger Monat">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <${h} class="kalender__monat" id="${id}-monat" aria-live="polite"></${h}>
        <button type="button" class="kalender__blaettern" data-richtung="1" aria-label="Nächster Monat">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <table class="kalender__tabelle" role="grid" aria-labelledby="${id}-monat">
        <thead><tr>${SPALTEN.map((wt) =>
          `<th scope="col" abbr="${WOCHENTAGE[wt]}"><span aria-hidden="true">${WOCHENTAGE[wt].slice(0, 2)}</span><span class="visually-hidden">${WOCHENTAGE[wt]}</span></th>`).join('')}</tr></thead>
        <tbody></tbody>
      </table>
      <ul class="kalender__legende" aria-label="Legende">
        ${o.legende.map((l) => `<li><span class="legende__muster tag ${l.klasse}" aria-hidden="true"></span>${l.text}</li>`).join('')}
      </ul>
      <p class="kalender__hilfe">Tipp: Mit den Pfeiltasten wechseln Sie den Tag, mit Bild↑/Bild↓ den Monat.</p>
    </div>`;

  const titel = wurzel.querySelector('.kalender__monat');
  const tbody = wurzel.querySelector('tbody');
  const zurueck = wurzel.querySelector('[data-richtung="-1"]');
  const vor = wurzel.querySelector('[data-richtung="1"]');

  function statusVon(datum) {
    return tagesStatus(datum, { heute: o.heute, bis: letzterTag, gesperrt: o.gesperrt });
  }

  function imBereich(datum) {
    return datum >= ersterTag && datum <= letzterTag;
  }

  /** Startpunkt für den Tastaturfokus im angezeigten Monat. */
  function standardFokus() {
    if (gewaehlt && gewaehlt.getMonth() === monat.getMonth() && gewaehlt.getFullYear() === monat.getFullYear()) return gewaehlt;
    const ende = new Date(monat.getFullYear(), monat.getMonth() + 1, 0);
    let erster = null;
    for (let t = new Date(monat); t <= ende; t = plusTage(t, 1)) {
      if (!imBereich(t)) continue;
      if (!erster) erster = t;
      if (o.waehlbar(statusVon(t))) return t;
    }
    return erster;
  }

  function zeichne() {
    titel.textContent = `${MONATE[monat.getMonth()]} ${monat.getFullYear()}`;
    zurueck.disabled = monat <= new Date(ersterTag.getFullYear(), ersterTag.getMonth(), 1);
    vor.disabled = monat >= new Date(letzterTag.getFullYear(), letzterTag.getMonth(), 1);

    if (!fokus || fokus.getMonth() !== monat.getMonth() || fokus.getFullYear() !== monat.getFullYear()) {
      fokus = standardFokus();
    }

    const ersterImMonat = new Date(monat.getFullYear(), monat.getMonth(), 1);
    const versatz = (ersterImMonat.getDay() + 6) % 7; // Leerfelder vor dem 1. (Montag = 0)
    const tageImMonat = new Date(monat.getFullYear(), monat.getMonth() + 1, 0).getDate();

    let html = '';
    let zelle = 0;
    for (let woche = 0; zelle < versatz + tageImMonat; woche++) {
      html += '<tr>';
      for (let spalte = 0; spalte < 7; spalte++, zelle++) {
        const nr = zelle - versatz + 1;
        if (nr < 1 || nr > tageImMonat) {
          html += '<td role="gridcell" class="kalender__leer"></td>';
          continue;
        }
        const datum = new Date(monat.getFullYear(), monat.getMonth(), nr);
        const status = statusVon(datum);
        const kannWaehlen = o.waehlbar(status);
        const istGewaehlt = gleicherTag(datum, gewaehlt);
        const istHeute = gleicherTag(datum, o.heute);
        const klassen = ['tag', kannWaehlen ? 'tag--verfuegbar' : 'tag--gesperrt'];
        if (istGewaehlt) klassen.push('tag--gewaehlt');
        if (istHeute) klassen.push('tag--heute');
        const extra = o.zusatzKlasse(datum, status);
        if (extra) klassen.push(extra);
        const label = `${datumLang(datum)}${istHeute ? ', heute' : ''}, ${o.beschriftung(status)}${istGewaehlt ? ', ausgewählt' : ''}`;
        html += `<td role="gridcell"${istGewaehlt ? ' aria-selected="true"' : ''}>`
          + `<button type="button" class="${klassen.join(' ')}" data-datum="${datumsSchluessel(datum)}"`
          + ` tabindex="${gleicherTag(datum, fokus) ? 0 : -1}" aria-label="${label}"`
          + `${kannWaehlen ? '' : ' aria-disabled="true"'}${istHeute ? ' aria-current="date"' : ''}>`
          + `<span aria-hidden="true">${nr}</span></button></td>`;
      }
      html += '</tr>';
    }
    tbody.innerHTML = html;
  }

  function knopfFuer(datum) {
    return tbody.querySelector(`[data-datum="${datumsSchluessel(datum)}"]`);
  }

  /** Fokus auf einen Tag setzen; wechselt bei Bedarf den Monat. */
  function setzeFokus(ziel) {
    if (ziel < ersterTag) ziel = ersterTag;
    if (ziel > letzterTag) ziel = letzterTag;
    fokus = ziel;
    if (ziel.getMonth() !== monat.getMonth() || ziel.getFullYear() !== monat.getFullYear()) {
      monat = new Date(ziel.getFullYear(), ziel.getMonth(), 1);
    }
    zeichne();
    knopfFuer(ziel)?.focus();
  }

  function blaettern(richtung) {
    monat = new Date(monat.getFullYear(), monat.getMonth() + richtung, 1);
    fokus = null;
    zeichne();
  }

  /* Ereignisse */
  zurueck.addEventListener('click', () => blaettern(-1));
  vor.addEventListener('click', () => blaettern(1));

  tbody.addEventListener('click', (ereignis) => {
    const knopf = ereignis.target.closest('button[data-datum]');
    if (!knopf) return;
    const datum = ausSchluessel(knopf.dataset.datum);
    fokus = datum;
    const status = statusVon(datum);
    if (!o.waehlbar(status)) {
      zeichne();
      knopfFuer(datum)?.focus();
      return;
    }
    gewaehlt = datum;
    zeichne();
    knopfFuer(datum)?.focus();
    o.beiAuswahl(datum, status);
  });

  tbody.addEventListener('keydown', (ereignis) => {
    const knopf = ereignis.target.closest('button[data-datum]');
    if (!knopf) return;
    const datum = ausSchluessel(knopf.dataset.datum);
    const wt = (datum.getDay() + 6) % 7; // Montag = 0
    const ziele = {
      ArrowLeft: () => plusTage(datum, -1),
      ArrowRight: () => plusTage(datum, 1),
      ArrowUp: () => plusTage(datum, -7),
      ArrowDown: () => plusTage(datum, 7),
      Home: () => plusTage(datum, -wt),
      End: () => plusTage(datum, 6 - wt),
      PageUp: () => plusMonate(datum, -1),
      PageDown: () => plusMonate(datum, 1),
    };
    if (!ziele[ereignis.key]) return;
    ereignis.preventDefault();
    setzeFokus(ziele[ereignis.key]());
  });

  zeichne();

  return {
    /** Neue Sperrliste übernehmen (z. B. nach dem Laden oder in der Verwaltung). */
    setzeGesperrt(gesperrt) {
      o.gesperrt = gesperrt;
      if (gewaehlt && !o.waehlbar(statusVon(gewaehlt))) gewaehlt = null;
      zeichne();
    },
    /** Ansicht neu zeichnen, z. B. wenn sich Markierungen der Verwaltung geändert haben. */
    aktualisiere() { zeichne(); },
    /** Auswahl aufheben. */
    hebeAuswahlAuf() { gewaehlt = null; zeichne(); },
    get gewaehlt() { return gewaehlt; },
    statusVon,
  };
}
