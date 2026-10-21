/**
 * Verwaltungsseite: „nicht verfügbar“-Zeiten eintragen und über die GitHub-API speichern.
 *
 * - Der Zugangsschlüssel (fine-grained Token) liegt NUR im localStorage dieses Geräts.
 * - Einzige externe Verbindung: https://api.github.com (siehe Content-Security-Policy der Seite).
 * - Alle Texte werden mit textContent gesetzt – nichts aus Eingaben oder der Datei wird als HTML ausgegeben.
 */
import {
  erstelleKalender, leseVerfuegbarkeit, ausSchluessel, datumKurz, datumsSchluessel, plusTage, heute as heuteHolen,
} from './kalender.js';

/* ================================================================== EINSTELLUNGEN
 * Zentrale Stelle für alles, was sich beim Go-live ändert.
 *
 * ZIEL-BRANCH: Zum Testen wird in den Arbeitsbranch gespeichert.
 * >>> Beim Go-live hier 'main' eintragen! <<<
 */
export const EINSTELLUNGEN = Object.freeze({
  besitzer: 'Ernstbaerent',
  repo: 'website-martin-huth',
  branch: 'claude/great-wozniak-jyhyo8',
  datei: 'data/verfuegbarkeit.json',
  commitNachricht: 'Verfügbarkeit aktualisiert',
  warnenTageVorAblauf: 30,
});

const SPEICHER_SCHLUESSEL = 'kalenderPflege.schluessel';
const SPEICHER_ABLAUF = 'kalenderPflege.ablauf';

/* ================================================================== Einträge bearbeiten (reine Funktionen) */

/** Sortiert, entfernt Doppelte und fasst überlappende oder direkt aneinandergrenzende Zeiträume zusammen. */
export function normalisiere(eintraege) {
  const liste = eintraege
    .map((e) => ({ von: ausSchluessel(e.von), bis: ausSchluessel(e.bis ?? e.von) }))
    .filter((e) => e.von && e.bis)
    .map((e) => (e.bis < e.von ? { von: e.bis, bis: e.von } : e))
    .sort((a, b) => a.von - b.von);
  const ergebnis = [];
  for (const e of liste) {
    const letzter = ergebnis[ergebnis.length - 1];
    if (letzter && e.von <= plusTage(letzter.bis, 1)) {
      if (e.bis > letzter.bis) letzter.bis = e.bis;
    } else {
      ergebnis.push({ ...e });
    }
  }
  return ergebnis.map((e) => ({ von: datumsSchluessel(e.von), bis: datumsSchluessel(e.bis) }));
}

/** Zeitraum (von–bis, als Date) hinzufügen. */
export function fuegeHinzu(eintraege, von, bis) {
  return normalisiere([...eintraege, { von: datumsSchluessel(von), bis: datumsSchluessel(bis) }]);
}

/** Einen einzelnen Tag freigeben; ein Zeitraum wird dabei ggf. in zwei Teile geteilt. */
export function gibTagFrei(eintraege, tag) {
  const t = datumsSchluessel(tag);
  const ergebnis = [];
  for (const e of eintraege) {
    if (t < e.von || t > e.bis) { ergebnis.push(e); continue; }
    if (e.von < t) ergebnis.push({ von: e.von, bis: datumsSchluessel(plusTage(tag, -1)) });
    if (t < e.bis) ergebnis.push({ von: datumsSchluessel(plusTage(tag, 1)), bis: e.bis });
  }
  return normalisiere(ergebnis);
}

/** Den ganzen Eintrag entfernen, der diesen Tag enthält. */
export function entferneEintragMit(eintraege, tag) {
  const t = datumsSchluessel(tag);
  return eintraege.filter((e) => t < e.von || t > e.bis);
}

/** Eintrag finden, der diesen Tag enthält. */
export function eintragMit(eintraege, tag) {
  const t = datumsSchluessel(tag);
  return eintraege.find((e) => t >= e.von && t <= e.bis) ?? null;
}

/** Einträge, die vollständig in der Vergangenheit liegen, fallen weg (sie spielen keine Rolle mehr). */
export function ohneVergangene(eintraege, heute) {
  const h = datumsSchluessel(heute);
  return eintraege.filter((e) => e.bis >= h);
}

/** Anzahl Kalendertage eines Eintrags. */
export function anzahlTage(e) {
  return Math.round((ausSchluessel(e.bis) - ausSchluessel(e.von)) / 86400000) + 1;
}

/** Lesbarer Text eines Eintrags, z. B. „Montag, 09.11.2026 bis Freitag, 13.11.2026 (5 Tage)“. */
export function eintragText(e) {
  const von = datumKurz(ausSchluessel(e.von));
  if (e.von === e.bis) return von;
  return `${von} bis ${datumKurz(ausSchluessel(e.bis))} (${anzahlTage(e)} Tage)`;
}

/** Inhalt für data/verfuegbarkeit.json – nur Datumsangaben, nie ein Grund. */
export function alsJson(eintraege) {
  const zeilen = normalisiere(eintraege).map((e) => `    { "von": "${e.von}", "bis": "${e.bis}" }`);
  return `{\n  "nichtVerfuegbar": [${zeilen.length ? `\n${zeilen.join(',\n')}\n  ` : ''}]\n}\n`;
}

/* ================================================================== Zugangsschlüssel */

/** Prüft die Form des Schlüssels. Gibt eine Fehlermeldung oder null zurück. */
export function pruefeSchluessel(text) {
  if (!text) return 'Bitte fügen Sie den Zugangsschlüssel ein.';
  if (/^gh[opsu]_/.test(text)) return 'Das ist ein älterer Schlüsseltyp. Bitte einen „fine-grained“ Schlüssel verwenden (beginnt mit github_pat_) – bitte Clemens melden.';
  if (!/^github_pat_[A-Za-z0-9_]{20,}$/.test(text)) return 'Der Schlüssel sieht nicht richtig aus. Er beginnt mit github_pat_ und enthält keine Leerzeichen.';
  return null;
}

/** Tage bis zum Ablaufdatum (negativ = abgelaufen) oder null, wenn kein Datum hinterlegt ist. */
export function tageBisAblauf(ablauf, heute) {
  const d = ausSchluessel(ablauf);
  if (!d) return null;
  return Math.round((d - heute) / 86400000);
}

/* ================================================================== GitHub-API */

export class ApiFehler extends Error {
  constructor(art, status = 0) {
    super(art);
    this.art = art;
    this.status = status;
  }
}

/** Verständliche deutsche Meldung zu einem Fehler. */
export function fehlerText(fehler) {
  switch (fehler.art) {
    case 'schluessel': return 'Der Zugangsschlüssel ist abgelaufen oder ungültig – bitte Clemens melden.';
    case 'rechte': return 'Der Zugangsschlüssel darf hier nicht speichern – bitte Clemens melden.';
    case 'limit': return 'GitHub hat gerade zu viele Anfragen bekommen. Bitte in einer Stunde noch einmal versuchen.';
    case 'nichtGefunden': return 'Die Kalenderdatei wurde nicht gefunden – bitte Clemens melden.';
    case 'konflikt': return 'Der Kalender wurde in der Zwischenzeit an anderer Stelle geändert.';
    case 'netz': return 'Keine Verbindung. Bitte prüfen Sie die Internetverbindung und versuchen Sie es noch einmal.';
    case 'inhalt': return 'Die Kalenderdatei ist beschädigt – bitte Clemens melden.';
    default: return `Das hat nicht geklappt (Fehler ${fehler.status || 'unbekannt'}). Bitte später noch einmal versuchen oder Clemens melden.`;
  }
}

function artZuStatus(status, kopf) {
  if (status === 401) return 'schluessel';
  if (status === 403 || status === 429) {
    return kopf.get('x-ratelimit-remaining') === '0' || status === 429 ? 'limit' : 'rechte';
  }
  if (status === 404) return 'nichtGefunden';
  if (status === 409) return 'konflikt';
  return 'sonst';
}

/** UTF-8-sicheres Base64 (die GitHub-API liefert und erwartet Dateiinhalte so). */
export function zuBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binaer = '';
  for (const b of bytes) binaer += String.fromCharCode(b);
  return btoa(binaer);
}
export function ausBase64(b64) {
  const binaer = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binaer, (z) => z.charCodeAt(0)));
}

function dateiAdresse(e = EINSTELLUNGEN) {
  return `https://api.github.com/repos/${e.besitzer}/${e.repo}/contents/${e.datei}`;
}

async function anfrage(schluessel, adresse, optionen = {}) {
  let antwort;
  try {
    antwort = await fetch(adresse, {
      ...optionen,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${schluessel}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(optionen.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new ApiFehler('netz');
  }
  if (!antwort.ok) throw new ApiFehler(artZuStatus(antwort.status, antwort.headers), antwort.status);
  return antwort.json();
}

/** Aktuelle Datei laden. Ergebnis: { eintraege, sha } */
export async function ladeVonGithub(schluessel, e = EINSTELLUNGEN) {
  const daten = await anfrage(schluessel, `${dateiAdresse(e)}?ref=${encodeURIComponent(e.branch)}`);
  let inhalt;
  try {
    inhalt = JSON.parse(ausBase64(daten.content));
  } catch {
    throw new ApiFehler('inhalt');
  }
  return { eintraege: normalisiere(leseVerfuegbarkeit(inhalt).eintraege), sha: daten.sha };
}

/** Datei speichern (mit dem sha des zuletzt geladenen Stands). Ergebnis: neuer sha. */
export async function speichereAufGithub(schluessel, eintraege, sha, e = EINSTELLUNGEN) {
  const daten = await anfrage(schluessel, dateiAdresse(e), {
    method: 'PUT',
    body: JSON.stringify({
      message: e.commitNachricht,
      content: zuBase64(alsJson(eintraege)),
      sha,
      branch: e.branch,
    }),
  });
  return daten.content.sha;
}

/* ================================================================== Seite (nur im Browser) */

const speicher = {
  lies(k) { try { return localStorage.getItem(k); } catch { return null; } },
  schreib(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  loesch(k) { try { localStorage.removeItem(k); } catch { /* nichts zu tun */ } },
};

function starteVerwaltung() {
  const $ = (id) => document.getElementById(id);
  const heute = heuteHolen();

  const el = {
    anmeldung: $('anmeldung'), anmeldeFormular: $('anmelde-formular'), schluessel: $('schluessel'),
    ablauf: $('ablauf'), anmeldeMeldung: $('anmelde-meldung'), anmeldeKnopf: $('anmelde-knopf'),
    bereich: $('bereich'), abmelden: $('abmelden'), schluesselInfo: $('schluessel-info'),
    testbetrieb: $('testbetrieb'), kalender: $('verwaltung-kalender'), auswahl: $('auswahl'),
    auswahlText: $('auswahl-text'), auswahlKnoepfe: $('auswahl-knoepfe'), liste: $('liste'),
    listeLeer: $('liste-leer'), speichern: $('speichern'), speicherStatus: $('speicher-status'),
    aenderungen: $('aenderungen'), konflikt: $('konflikt'),
  };

  let schluessel = speicher.lies(SPEICHER_SCHLUESSEL);
  let eintraege = [];
  let sha = null;
  let geaendert = false;
  let start = null; // erster Tag eines Zeitraums
  let kalender = null;

  /* ---------- Meldungen ---------- */
  function meldung(ziel, text, art = 'info') {
    ziel.textContent = text;
    ziel.className = `meldung meldung--${art}`;
    ziel.hidden = !text;
  }

  /* ---------- Testbetrieb-Hinweis ---------- */
  if (EINSTELLUNGEN.branch !== 'main') {
    el.testbetrieb.textContent = `Testbetrieb: Änderungen werden im Zweig „${EINSTELLUNGEN.branch}“ gespeichert und erscheinen noch nicht auf der Website.`;
    el.testbetrieb.hidden = false;
  }

  /* ---------- Ablaufdatum des Schlüssels ---------- */
  function zeigeSchluesselInfo() {
    const ablauf = speicher.lies(SPEICHER_ABLAUF);
    const tage = tageBisAblauf(ablauf, heute);
    if (tage === null) {
      meldung(el.schluesselInfo, 'Angemeldet. Für den Zugangsschlüssel ist kein Ablaufdatum hinterlegt.', 'info');
    } else if (tage < 0) {
      meldung(el.schluesselInfo, `Der Zugangsschlüssel ist am ${datumKurz(ausSchluessel(ablauf))} abgelaufen – bitte Clemens melden.`, 'fehler');
    } else if (tage <= EINSTELLUNGEN.warnenTageVorAblauf) {
      const wann = tage === 0 ? 'heute' : tage === 1 ? 'morgen' : `in ${tage} Tagen`;
      meldung(el.schluesselInfo, `Achtung: Der Zugangsschlüssel läuft ${wann} ab (${datumKurz(ausSchluessel(ablauf))}). Bitte rechtzeitig Clemens Bescheid geben.`, 'warnung');
    } else {
      meldung(el.schluesselInfo, `Angemeldet. Zugangsschlüssel gültig bis ${datumKurz(ausSchluessel(ablauf))}.`, 'info');
    }
  }

  /* ---------- Ansicht aktualisieren ---------- */
  function setzeGeaendert(wert) {
    geaendert = wert;
    el.aenderungen.hidden = !wert;
  }

  function zeichneListe() {
    el.liste.replaceChildren();
    el.listeLeer.hidden = eintraege.length > 0;
    for (const e of eintraege) {
      const li = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = eintragText(e);
      const knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.className = 'knopf knopf--leise knopf--klein';
      knopf.textContent = 'Löschen';
      knopf.setAttribute('aria-label', `Eintrag ${eintragText(e)} löschen`);
      knopf.addEventListener('click', () => {
        eintraege = eintraege.filter((x) => x !== e);
        nachAenderung(`Eintrag gelöscht: ${eintragText(e)}.`);
      });
      li.append(text, knopf);
      el.liste.append(li);
    }
  }

  function aktualisiereKalender() {
    kalender.setzeGesperrt(leseVerfuegbarkeit({ nichtVerfuegbar: eintraege }).gesperrt);
  }

  function nachAenderung(text) {
    start = null;
    kalender.hebeAuswahlAuf();
    aktualisiereKalender();
    zeichneListe();
    setzeGeaendert(true);
    zeigeAuswahl(`${text} Bitte zum Veröffentlichen auf „Speichern“ tippen.`, []);
    meldung(el.speicherStatus, '');
  }

  /* ---------- Hinweisfeld unter dem Kalender ---------- */
  function zeigeAuswahl(text, knoepfe, insBild = true) {
    el.auswahlText.textContent = text;
    el.auswahlKnoepfe.replaceChildren(...knoepfe.map(([beschriftung, aktion, leise]) => {
      const k = document.createElement('button');
      k.type = 'button';
      k.className = leise ? 'knopf knopf--leise knopf--gross' : 'knopf knopf--gross';
      k.textContent = beschriftung;
      k.addEventListener('click', aktion);
      return k;
    }));
    // Nach einem Tipp in den Kalender den Hinweis ins Bild holen (am Handy wichtig)
    if (insBild) {
      const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.auswahl.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'nearest' });
    }
  }

  const ANFANGSTEXT = 'Tippen Sie im Kalender auf den ersten Tag, an dem Sie nicht verfügbar sind.';

  function abbrechen() {
    start = null;
    kalender.hebeAuswahlAuf();
    zeigeAuswahl(ANFANGSTEXT, []);
  }

  function beiTag(datum, status) {
    if (start === null && status === 'gesperrt') {
      const e = eintragMit(eintraege, datum);
      const knoepfe = [['Diesen Tag freigeben', () => {
        eintraege = gibTagFrei(eintraege, datum);
        nachAenderung(`${datumKurz(datum)} ist wieder frei.`);
      }]];
      if (e && e.von !== e.bis) {
        knoepfe.push(['Ganzen Zeitraum freigeben', () => {
          eintraege = entferneEintragMit(eintraege, datum);
          nachAenderung(`Zeitraum freigegeben: ${eintragText(e)}.`);
        }, true]);
      }
      knoepfe.push(['Abbrechen', abbrechen, true]);
      zeigeAuswahl(`${datumKurz(datum)} ist als „nicht verfügbar“ eingetragen${e && e.von !== e.bis ? ` (${eintragText(e)})` : ''}.`, knoepfe);
      return;
    }
    if (start === null) {
      start = datum;
      zeigeAuswahl(`Erster Tag: ${datumKurz(datum)}. Tippen Sie jetzt auf den letzten Tag – oder noch einmal auf denselben Tag, wenn es nur ein Tag ist.`, [
        ['Nur diesen Tag eintragen', () => {
          eintraege = fuegeHinzu(eintraege, datum, datum);
          nachAenderung(`Eingetragen: ${datumKurz(datum)}.`);
        }],
        ['Abbrechen', abbrechen, true],
      ]);
      return;
    }
    const von = datum < start ? datum : start;
    const bis = datum < start ? start : datum;
    eintraege = fuegeHinzu(eintraege, von, bis);
    const e = eintragMit(eintraege, von);
    nachAenderung(`Eingetragen: ${eintragText({ von: datumsSchluessel(von), bis: datumsSchluessel(bis) })}.${e && (e.von !== datumsSchluessel(von) || e.bis !== datumsSchluessel(bis)) ? ' Er wurde mit einem angrenzenden Eintrag zusammengefasst.' : ''}`);
  }

  /* ---------- Laden und Speichern ---------- */
  async function lade() {
    const daten = await ladeVonGithub(schluessel);
    eintraege = ohneVergangene(daten.eintraege, heute);
    sha = daten.sha;
    setzeGeaendert(false);
    start = null;
    if (!kalender) {
      kalender = erstelleKalender(el.kalender, {
        ueberschrift: 3,
        waehlbar: (s) => s === 'verfuegbar' || s === 'gesperrt',
        beschriftung: (s) => ({
          verfuegbar: 'frei', gesperrt: 'nicht verfügbar, eingetragen', wochenende: 'Wochenende',
          feiertag: 'Feiertag', vergangen: 'vergangen', 'zu-weit': 'außerhalb der 12 Monate',
        })[s],
        zusatzKlasse: (_d, s) => (s === 'gesperrt' ? 'tag--eingetragen' : ''),
        beiAuswahl: beiTag,
        legende: [
          { klasse: 'tag--verfuegbar', text: 'frei' },
          { klasse: 'tag--verfuegbar tag--eingetragen', text: 'nicht verfügbar (eingetragen)' },
          { klasse: 'tag--gesperrt', text: 'Wochenende, Feiertag' },
          { klasse: 'tag--gewaehlt', text: 'gewählter erster Tag' },
        ],
      });
    }
    aktualisiereKalender();
    kalender.hebeAuswahlAuf();
    zeichneListe();
    zeigeAuswahl(ANFANGSTEXT, [], false);
  }

  async function speichere(trotzKonflikt = false) {
    if (!geaendert && !trotzKonflikt) {
      meldung(el.speicherStatus, 'Es gibt keine Änderungen zu speichern.', 'info');
      return;
    }
    el.speichern.disabled = true;
    el.konflikt.hidden = true;
    meldung(el.speicherStatus, 'Wird gespeichert …', 'info');
    try {
      if (trotzKonflikt) sha = (await ladeVonGithub(schluessel)).sha; // neuesten Stand als Grundlage nehmen
      eintraege = ohneVergangene(eintraege, heute);
      sha = await speichereAufGithub(schluessel, eintraege, sha);
      setzeGeaendert(false);
      zeichneListe();
      meldung(el.speicherStatus, 'Gespeichert – in wenigen Minuten online.', 'erfolg');
    } catch (fehler) {
      const f = fehler instanceof ApiFehler ? fehler : new ApiFehler('sonst');
      meldung(el.speicherStatus, fehlerText(f), 'fehler');
      if (f.art === 'konflikt') el.konflikt.hidden = false;
    } finally {
      el.speichern.disabled = false;
    }
  }

  /* ---------- An- und Abmelden ---------- */
  function zeigeAngemeldet(angemeldet) {
    el.anmeldung.hidden = angemeldet;
    el.bereich.hidden = !angemeldet;
    el.abmelden.hidden = !angemeldet;
  }

  el.anmeldeFormular.addEventListener('submit', async (ereignis) => {
    ereignis.preventDefault();
    const text = el.schluessel.value.trim();
    const problem = pruefeSchluessel(text);
    if (problem) {
      meldung(el.anmeldeMeldung, problem, 'fehler');
      el.schluessel.setAttribute('aria-invalid', 'true');
      el.schluessel.focus();
      return;
    }
    el.schluessel.removeAttribute('aria-invalid');
    el.anmeldeKnopf.disabled = true;
    meldung(el.anmeldeMeldung, 'Schlüssel wird geprüft …', 'info');
    schluessel = text;
    try {
      await lade();
      if (!speicher.schreib(SPEICHER_SCHLUESSEL, text)) {
        meldung(el.anmeldeMeldung, 'Der Browser erlaubt kein Speichern auf diesem Gerät (privates Fenster?). Sie müssen sich jedes Mal neu anmelden.', 'warnung');
      }
      if (el.ablauf.value) speicher.schreib(SPEICHER_ABLAUF, el.ablauf.value);
      else speicher.loesch(SPEICHER_ABLAUF);
      el.schluessel.value = '';
      meldung(el.anmeldeMeldung, '');
      zeigeAngemeldet(true);
      zeigeSchluesselInfo();
    } catch (fehler) {
      schluessel = null;
      meldung(el.anmeldeMeldung, fehlerText(fehler instanceof ApiFehler ? fehler : new ApiFehler('sonst')), 'fehler');
    } finally {
      el.anmeldeKnopf.disabled = false;
    }
  });

  el.abmelden.addEventListener('click', () => {
    if (geaendert && !window.confirm('Es gibt nicht gespeicherte Änderungen. Trotzdem abmelden?')) return;
    speicher.loesch(SPEICHER_SCHLUESSEL);
    speicher.loesch(SPEICHER_ABLAUF);
    schluessel = null;
    eintraege = [];
    setzeGeaendert(false);
    meldung(el.speicherStatus, '');
    zeigeAngemeldet(false);
    meldung(el.anmeldeMeldung, 'Sie sind abgemeldet. Der Schlüssel wurde von diesem Gerät gelöscht.', 'info');
  });

  el.speichern.addEventListener('click', () => speichere());
  $('konflikt-ueberschreiben').addEventListener('click', () => speichere(true));
  $('konflikt-neu-laden').addEventListener('click', async () => {
    el.konflikt.hidden = true;
    try {
      await lade();
      meldung(el.speicherStatus, 'Der aktuelle Stand wurde geladen.', 'info');
    } catch (fehler) {
      meldung(el.speicherStatus, fehlerText(fehler), 'fehler');
    }
  });

  window.addEventListener('beforeunload', (ereignis) => {
    if (geaendert) { ereignis.preventDefault(); ereignis.returnValue = ''; }
  });

  /* ---------- Start ---------- */
  if (schluessel) {
    zeigeAngemeldet(true);
    zeigeSchluesselInfo();
    meldung(el.speicherStatus, 'Kalender wird geladen …', 'info');
    lade()
      .then(() => meldung(el.speicherStatus, ''))
      .catch((fehler) => {
        meldung(el.speicherStatus, fehlerText(fehler instanceof ApiFehler ? fehler : new ApiFehler('sonst')), 'fehler');
      });
  } else {
    zeigeAngemeldet(false);
  }
}

if (typeof document !== 'undefined' && document.getElementById('verwaltung')) starteVerwaltung();
