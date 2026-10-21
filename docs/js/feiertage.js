/**
 * Gesetzliche Feiertage in Deutschland – komplett lokal berechnet, ohne externen Dienst.
 *
 * Gesperrt werden die bundesweiten Feiertage UND alle regionalen Feiertage, die in
 * mindestens einem Bundesland gelten (Termine können überall in Deutschland stattfinden).
 *
 * Läuft im Browser und in Node (ES-Modul). Tests: node tests/feiertage.test.mjs
 */

/**
 * Ostersonntag nach der Gaußschen Osterformel (gregorianischer Kalender,
 * mit den beiden Ausnahmeregeln für den 26. und 25. April).
 * @param {number} jahr
 * @returns {Date} Ostersonntag (lokale Zeit, 00:00 Uhr)
 */
export function ostersonntag(jahr) {
  const a = jahr % 19;
  const b = jahr % 4;
  const c = jahr % 7;
  const k = Math.floor(jahr / 100);
  const p = Math.floor((8 * k + 13) / 25);
  const q = Math.floor(k / 4);
  const M = (15 + k - p - q) % 30;
  const N = (4 + k - q) % 7;
  const d = (19 * a + M) % 30;
  const e = (2 * b + 4 * c + 6 * d + N) % 7;

  let tagImMaerz = 22 + d + e; // 32 = 1. April usw.

  // Ausnahmen der Gaußschen Formel
  if (d === 29 && e === 6) {
    tagImMaerz = 50; // 26. April → 19. April
  } else if (d === 28 && e === 6 && (11 * M + 11) % 30 < 19) {
    tagImMaerz = 49; // 25. April → 18. April
  }

  return new Date(jahr, 2, tagImMaerz); // Monat 2 = März; Date rechnet Überlauf in den April um
}

/** Hilfsfunktion: Datum plus Anzahl Tage (ohne Zeitzonen-Fallen, da lokal mit 00:00 Uhr). */
function plusTage(datum, tage) {
  return new Date(datum.getFullYear(), datum.getMonth(), datum.getDate() + tage);
}

/** Buß- und Bettag: der Mittwoch vor dem 23. November (also zwischen 16. und 22. November). */
function bussUndBettag(jahr) {
  const tag = new Date(jahr, 10, 22); // 22. November
  while (tag.getDay() !== 3) tag.setDate(tag.getDate() - 1); // 3 = Mittwoch
  return tag;
}

/** Datum als Schlüssel „JJJJ-MM-TT“ (lokale Zeit). */
export function datumsSchluessel(datum) {
  const j = datum.getFullYear();
  const m = String(datum.getMonth() + 1).padStart(2, '0');
  const t = String(datum.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

/**
 * Alle Feiertage eines Jahres.
 * @param {number} jahr
 * @returns {{datum: Date, name: string, bundesweit: boolean}[]} chronologisch sortiert
 */
export function feiertage(jahr) {
  const ostern = ostersonntag(jahr);
  const liste = [
    // bundesweit
    { datum: new Date(jahr, 0, 1), name: 'Neujahr', bundesweit: true },
    { datum: plusTage(ostern, -2), name: 'Karfreitag', bundesweit: true },
    { datum: plusTage(ostern, 1), name: 'Ostermontag', bundesweit: true },
    { datum: new Date(jahr, 4, 1), name: 'Tag der Arbeit', bundesweit: true },
    { datum: plusTage(ostern, 39), name: 'Christi Himmelfahrt', bundesweit: true },
    { datum: plusTage(ostern, 50), name: 'Pfingstmontag', bundesweit: true },
    { datum: new Date(jahr, 9, 3), name: 'Tag der Deutschen Einheit', bundesweit: true },
    { datum: new Date(jahr, 11, 25), name: '1. Weihnachtstag', bundesweit: true },
    { datum: new Date(jahr, 11, 26), name: '2. Weihnachtstag', bundesweit: true },
    // regional (in einzelnen Bundesländern) – ebenfalls gesperrt
    { datum: new Date(jahr, 0, 6), name: 'Heilige Drei Könige', bundesweit: false },
    { datum: new Date(jahr, 2, 8), name: 'Internationaler Frauentag', bundesweit: false },
    { datum: plusTage(ostern, 60), name: 'Fronleichnam', bundesweit: false },
    { datum: new Date(jahr, 7, 15), name: 'Mariä Himmelfahrt', bundesweit: false },
    { datum: new Date(jahr, 8, 20), name: 'Weltkindertag', bundesweit: false },
    { datum: new Date(jahr, 9, 31), name: 'Reformationstag', bundesweit: false },
    { datum: new Date(jahr, 10, 1), name: 'Allerheiligen', bundesweit: false },
    { datum: bussUndBettag(jahr), name: 'Buß- und Bettag', bundesweit: false },
  ];
  return liste.sort((x, y) => x.datum - y.datum);
}

const zwischenspeicher = new Map(); // Jahr → Map(Schlüssel → Name)

/**
 * Name des Feiertags an diesem Datum oder null.
 * Der Name ist nur für interne Zwecke (Tests, Verwaltung) – die öffentliche Seite zeigt ihn nie an.
 * @param {Date} datum
 * @returns {string|null}
 */
export function feiertagAm(datum) {
  const jahr = datum.getFullYear();
  if (!zwischenspeicher.has(jahr)) {
    zwischenspeicher.set(jahr, new Map(feiertage(jahr).map((f) => [datumsSchluessel(f.datum), f.name])));
  }
  return zwischenspeicher.get(jahr).get(datumsSchluessel(datum)) ?? null;
}

/** true, wenn an diesem Datum ein (bundesweiter oder regionaler) Feiertag ist. */
export function istFeiertag(datum) {
  return feiertagAm(datum) !== null;
}
