// Tests für js/feiertage.js – Aufruf: node tests/feiertage.test.mjs
import assert from 'node:assert/strict';
import { ostersonntag, feiertage, feiertagAm, istFeiertag, datumsSchluessel } from '../js/feiertage.js';

let anzahl = 0;
function test(name, fn) {
  try {
    fn();
    anzahl++;
    console.log(`  ok  ${name}`);
  } catch (fehler) {
    console.error(`FEHLER ${name}\n${fehler.message}`);
    process.exitCode = 1;
  }
}

const tag = (d) => datumsSchluessel(d);
const finde = (jahr, name) => {
  const f = feiertage(jahr).find((x) => x.name === name);
  assert.ok(f, `${name} ${jahr} fehlt`);
  return tag(f.datum);
};

console.log('Feiertage');

// --- Pflichtwerte aus dem Briefing ---
test('Ostersonntag 2026 = 05.04.2026', () => assert.equal(tag(ostersonntag(2026)), '2026-04-05'));
test('Ostersonntag 2027 = 28.03.2027', () => assert.equal(tag(ostersonntag(2027)), '2027-03-28'));
test('Fronleichnam 2026 = 04.06.2026', () => assert.equal(finde(2026, 'Fronleichnam'), '2026-06-04'));
test('Buß- und Bettag 2026 = 18.11.2026', () => assert.equal(finde(2026, 'Buß- und Bettag'), '2026-11-18'));

// --- weitere Osterdaten, inkl. der beiden Ausnahmefälle der Gaußschen Formel ---
const osterdaten = {
  2000: '2000-04-23', 2008: '2008-03-23', 2011: '2011-04-24', 2019: '2019-04-21',
  2024: '2024-03-31', 2025: '2025-04-20', 2028: '2028-04-16', 2030: '2030-04-21',
  2038: '2038-04-25',
  1981: '1981-04-19', // Ausnahme: 26. April → 19. April
  1954: '1954-04-18', // Ausnahme: 25. April → 18. April
  2049: '2049-04-18', // Ausnahme: 25. April → 18. April
};
for (const [jahr, erwartet] of Object.entries(osterdaten)) {
  test(`Ostersonntag ${jahr} = ${erwartet}`, () => assert.equal(tag(ostersonntag(Number(jahr))), erwartet));
}

// --- bewegliche Feiertage 2026 ---
test('Karfreitag 2026 = 03.04.2026', () => assert.equal(finde(2026, 'Karfreitag'), '2026-04-03'));
test('Ostermontag 2026 = 06.04.2026', () => assert.equal(finde(2026, 'Ostermontag'), '2026-04-06'));
test('Christi Himmelfahrt 2026 = 14.05.2026', () => assert.equal(finde(2026, 'Christi Himmelfahrt'), '2026-05-14'));
test('Pfingstmontag 2026 = 25.05.2026', () => assert.equal(finde(2026, 'Pfingstmontag'), '2026-05-25'));

// --- Buß- und Bettag in Grenzfällen (22.11. selbst ist ein Mittwoch bzw. 23.11. ist ein Mittwoch) ---
test('Buß- und Bettag 2028 = 22.11.2028 (22.11. ist Mittwoch)', () => assert.equal(finde(2028, 'Buß- und Bettag'), '2028-11-22'));
test('Buß- und Bettag 2022 = 16.11.2022 (23.11. ist Mittwoch)', () => assert.equal(finde(2022, 'Buß- und Bettag'), '2022-11-16'));
test('Buß- und Bettag 2027 = 17.11.2027', () => assert.equal(finde(2027, 'Buß- und Bettag'), '2027-11-17'));

// --- Vollständigkeit ---
test('2026 hat 17 Feiertage (9 bundesweit, 8 regional)', () => {
  const liste = feiertage(2026);
  assert.equal(liste.length, 17);
  assert.equal(liste.filter((f) => f.bundesweit).length, 9);
});
test('feste Feiertage 2026 werden erkannt', () => {
  for (const [m, t] of [[1, 1], [1, 6], [3, 8], [5, 1], [8, 15], [9, 20], [10, 3], [10, 31], [11, 1], [12, 25], [12, 26]]) {
    assert.ok(istFeiertag(new Date(2026, m - 1, t)), `${t}.${m}. fehlt`);
  }
});
test('normaler Werktag ist kein Feiertag', () => {
  assert.equal(feiertagAm(new Date(2026, 10, 3)), null); // Di, 03.11.2026
  assert.equal(istFeiertag(new Date(2026, 3, 7)), false); // Di nach Ostern
});
test('Datumsschlüssel ist lokal und zweistellig', () => assert.equal(tag(new Date(2026, 0, 5)), '2026-01-05'));

console.log(process.exitCode ? '\nEs gibt Fehler.' : `\nAlle ${anzahl} Tests bestanden.`);
