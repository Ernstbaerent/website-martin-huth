// Tests für js/verwaltung.js (ohne Browser) – Aufruf: node tests/verwaltung.test.mjs
import assert from 'node:assert/strict';
import {
  EINSTELLUNGEN, normalisiere, fuegeHinzu, gibTagFrei, entferneEintragMit, ohneVergangene, eintragText,
  alsJson, pruefeSchluessel, tageBisAblauf, zuBase64, ausBase64, fehlerText, ApiFehler,
} from '../docs/js/verwaltung.js';
import { leseVerfuegbarkeit } from '../docs/js/kalender.js';

let anzahl = 0;
function test(name, fn) {
  try { fn(); anzahl++; console.log(`  ok  ${name}`); }
  catch (fehler) { console.error(`FEHLER ${name}\n${fehler.message}`); process.exitCode = 1; }
}
const D = (j, m, t) => new Date(j, m - 1, t);
const E = (von, bis = von) => ({ von, bis });

console.log('Einträge bearbeiten');
test('Zeitraum mit zwei Daten hinzufügen', () => assert.deepEqual(fuegeHinzu([], D(2026, 11, 9), D(2026, 11, 13)), [E('2026-11-09', '2026-11-13')]));
test('überlappende und angrenzende Zeiträume werden zusammengefasst', () => {
  assert.deepEqual(normalisiere([E('2026-11-09', '2026-11-11'), E('2026-11-10', '2026-11-13'), E('2026-11-14'), E('2026-11-20')]),
    [E('2026-11-09', '2026-11-14'), E('2026-11-20')]);
});
test('Sortierung und vertauschte Daten', () => assert.deepEqual(normalisiere([E('2026-12-02'), E('2026-11-05', '2026-11-03')]), [E('2026-11-03', '2026-11-05'), E('2026-12-02')]));
test('Tag in der Mitte freigeben teilt den Zeitraum', () => {
  assert.deepEqual(gibTagFrei([E('2026-11-09', '2026-11-13')], D(2026, 11, 11)), [E('2026-11-09', '2026-11-10'), E('2026-11-12', '2026-11-13')]);
});
test('Randtag und Einzeltag freigeben', () => {
  assert.deepEqual(gibTagFrei([E('2026-11-09', '2026-11-13')], D(2026, 11, 9)), [E('2026-11-10', '2026-11-13')]);
  assert.deepEqual(gibTagFrei([E('2026-11-09')], D(2026, 11, 9)), []);
});
test('ganzen Zeitraum entfernen', () => assert.deepEqual(entferneEintragMit([E('2026-11-09', '2026-11-13'), E('2026-12-01')], D(2026, 11, 10)), [E('2026-12-01')]));
test('Vergangenes fällt weg, laufender Zeitraum bleibt', () => {
  assert.deepEqual(ohneVergangene([E('2026-10-01', '2026-10-05'), E('2026-10-19', '2026-10-23'), E('2026-11-02')], D(2026, 10, 21)),
    [E('2026-10-19', '2026-10-23'), E('2026-11-02')]);
});
test('lesbarer Text', () => {
  assert.equal(eintragText(E('2026-11-09', '2026-11-13')), 'Montag, 09.11.2026 bis Freitag, 13.11.2026 (5 Tage)');
  assert.equal(eintragText(E('2026-11-09')), 'Montag, 09.11.2026');
});

console.log('Datei');
test('JSON enthält nur Datumsangaben und ist von der Website lesbar', () => {
  const json = alsJson([E('2026-11-13', '2026-11-09'), E('2026-12-01')]);
  const daten = JSON.parse(json);
  assert.deepEqual(Object.keys(daten), ['nichtVerfuegbar']);
  assert.deepEqual(daten.nichtVerfuegbar, [E('2026-11-09', '2026-11-13'), E('2026-12-01')]);
  assert.equal(leseVerfuegbarkeit(daten).gesperrt.size, 6);
});
test('leere Liste ergibt gültiges JSON', () => assert.deepEqual(JSON.parse(alsJson([])), { nichtVerfuegbar: [] }));
test('Base64 hin und zurück, auch mit Umlauten', () => {
  const text = 'Verfügbarkeit – äöüß';
  assert.equal(ausBase64(zuBase64(text)), text);
  assert.equal(ausBase64('eyJh\nIjoxfQ=='), '{"a":1}'); // GitHub liefert mit Zeilenumbrüchen
});

console.log('Schlüssel und Fehler');
test('fine-grained Schlüssel wird akzeptiert', () => assert.equal(pruefeSchluessel('github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz'), null));
test('leer, klassischer Schlüssel und Tippfehler werden abgelehnt', () => {
  assert.ok(pruefeSchluessel(''));
  assert.match(pruefeSchluessel('ghp_abcdefghijklmnopqrstuvwxyz0123456789'), /fine-grained/);
  assert.ok(pruefeSchluessel('github_pat_ mit Leerzeichen'));
});
test('Tage bis Ablauf', () => {
  assert.equal(tageBisAblauf('2026-11-20', D(2026, 10, 21)), 30);
  assert.equal(tageBisAblauf('2026-10-20', D(2026, 10, 21)), -1);
  assert.equal(tageBisAblauf('', D(2026, 10, 21)), null);
});
test('Fehlermeldungen auf Deutsch', () => {
  assert.equal(fehlerText(new ApiFehler('schluessel', 401)), 'Der Zugangsschlüssel ist abgelaufen oder ungültig – bitte Clemens melden.');
  assert.match(fehlerText(new ApiFehler('sonst', 500)), /Fehler 500/);
});
test('Ziel-Branch ist zentral eingestellt', () => assert.equal(typeof EINSTELLUNGEN.branch, 'string'));

console.log(process.exitCode ? '\nEs gibt Fehler.' : `\nAlle ${anzahl} Tests bestanden.`);
