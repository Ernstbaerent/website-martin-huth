// Tests für js/kalender.js und js/anfrage.js (ohne Browser) – Aufruf: node tests/kalender-anfrage.test.mjs
import assert from 'node:assert/strict';
import { leseVerfuegbarkeit, tagesStatus, plusMonate, datumKurz, datumLang } from '../docs/js/kalender.js';
import { baueBetreff, baueText, baueMailto, pruefe, EMPFAENGER } from '../docs/js/anfrage.js';

let anzahl = 0;
function test(name, fn) {
  try { fn(); anzahl++; console.log(`  ok  ${name}`); }
  catch (fehler) { console.error(`FEHLER ${name}\n${fehler.message}`); process.exitCode = 1; }
}
const D = (j, m, t) => new Date(j, m - 1, t);

console.log('Verfügbarkeit');
test('Einzeltage und Zeiträume werden aufgelöst', () => {
  const { gesperrt, eintraege } = leseVerfuegbarkeit({ nichtVerfuegbar: [
    { von: '2026-11-02', bis: '2026-11-06' }, { von: '2026-12-14', bis: '2026-12-14' }, { von: '2026-12-21' },
  ] });
  assert.equal(eintraege.length, 3);
  assert.equal(gesperrt.size, 7);
  for (const t of ['2026-11-02', '2026-11-04', '2026-11-06', '2026-12-14', '2026-12-21']) assert.ok(gesperrt.has(t), t);
  assert.ok(!gesperrt.has('2026-11-07'));
});
test('vertauschtes von/bis wird korrigiert', () => {
  const { gesperrt } = leseVerfuegbarkeit({ nichtVerfuegbar: [{ von: '2026-11-10', bis: '2026-11-09' }] });
  assert.deepEqual([...gesperrt], ['2026-11-09', '2026-11-10']);
});
test('ungültige Einträge und kaputte Dateien werden übersprungen', () => {
  assert.equal(leseVerfuegbarkeit({ nichtVerfuegbar: [{ von: '2026-02-30' }, { von: 'morgen' }, null, 5] }).gesperrt.size, 0);
  assert.equal(leseVerfuegbarkeit(null).gesperrt.size, 0);
  assert.equal(leseVerfuegbarkeit({}).gesperrt.size, 0);
});
test('ein Grund in der Datei wird ignoriert und nie weitergegeben', () => {
  const { eintraege } = leseVerfuegbarkeit({ nichtVerfuegbar: [{ von: '2026-11-02', bis: '2026-11-02', grund: 'Urlaub' }] });
  assert.deepEqual(eintraege, [{ von: '2026-11-02', bis: '2026-11-02' }]);
});

console.log('Tagesstatus (heute = Mi, 21.10.2026)');
const heute = D(2026, 10, 21);
const bis = plusMonate(heute, 12);
const gesperrt = new Set(['2026-11-03']);
const st = (d) => tagesStatus(d, { heute, bis, gesperrt });
test('heute ist verfügbar', () => assert.equal(st(heute), 'verfuegbar'));
test('gestern ist vergangen', () => assert.equal(st(D(2026, 10, 20)), 'vergangen'));
test('Samstag und Sonntag sind gesperrt', () => { assert.equal(st(D(2026, 10, 24)), 'wochenende'); assert.equal(st(D(2026, 10, 25)), 'wochenende'); });
test('Buß- und Bettag ist gesperrt', () => assert.equal(st(D(2026, 11, 18)), 'feiertag'));
test('Eintrag aus verfuegbarkeit.json ist gesperrt', () => assert.equal(st(D(2026, 11, 3)), 'gesperrt'));
test('12 Monate voraus ist die Grenze', () => {
  assert.equal(datumKurz(bis), 'Donnerstag, 21.10.2027');
  assert.equal(st(D(2027, 10, 21)), 'verfuegbar');
  assert.equal(st(D(2027, 10, 22)), 'zu-weit');
});
test('Monatsende wird beim Blättern gekürzt', () => assert.equal(datumKurz(plusMonate(D(2027, 1, 31), 1)), 'Sonntag, 28.02.2027'));
test('Datum lang', () => assert.equal(datumLang(D(2026, 11, 9)), 'Montag, 9. November 2026'));

console.log('Anfrage-E-Mail');
const anfrage = {
  datum: D(2026, 11, 9), name: 'Erika Muster', organisation: 'Beispielamt & Co',
  email: 'erika@example.org', telefon: '', anliegen: 'Schulung für 10 Personen?\nZeile 2',
};
test('Betreff im vorgegebenen Format', () => assert.equal(baueBetreff(anfrage), 'Terminanfrage: Montag, 09.11.2026 – Beispielamt & Co'));
test('Text enthält alle Angaben', () => {
  const text = baueText(anfrage);
  for (const teil of ['Montag, 09.11.2026', 'Erika Muster', 'Beispielamt & Co', 'erika@example.org', 'Telefon:       –', 'Schulung für 10 Personen?']) {
    assert.ok(text.includes(teil), teil);
  }
});
test('mailto-Link geht an die richtige Adresse und ist sauber kodiert', () => {
  const link = baueMailto(anfrage);
  assert.ok(link.startsWith(`mailto:${EMPFAENGER}?subject=`));
  assert.equal(EMPFAENGER, 'martin.huth@it-profis.biz');
  assert.ok(!link.includes(' ') && !link.includes('&Co') && !link.includes('\n'));
  const params = new URLSearchParams(link.split('?')[1]);
  assert.equal(params.get('subject'), baueBetreff(anfrage));
  assert.equal(params.get('body'), baueText(anfrage));
  assert.ok(params.get('body').includes('\r\n'));
});
test('Pflichtfelder werden geprüft', () => {
  assert.deepEqual(Object.keys(pruefe({ name: '', organisation: '', email: '', anliegen: '' })), ['name', 'organisation', 'email', 'anliegen']);
  assert.ok(pruefe({ ...anfrage, email: 'kein-at' }).email);
  assert.deepEqual(pruefe(anfrage), {});
});

console.log(process.exitCode ? '\nEs gibt Fehler.' : `\nAlle ${anzahl} Tests bestanden.`);
