/**
 * Startpunkt der öffentlichen Seite: verbindet Kalender und Terminanfrage.
 * (Eine eigene Datei, weil die Sicherheitsregel der Seite eingebettetes JavaScript verbietet.)
 */
import { erstelleKalender, ladeVerfuegbarkeit } from './kalender.js';
import { richteAnfrageEin, richteKopierknopfEin } from './anfrage.js';

const wurzel = document.getElementById('kalender');
const hinweis = document.getElementById('kalender-hinweis');

if (wurzel) {
  wurzel.innerHTML = '<p class="kalender__laden">Kalender wird geladen …</p>';
  const daten = await ladeVerfuegbarkeit('data/verfuegbarkeit.json');

  if (!daten.ok) {
    hinweis.textContent = 'Die aktuelle Terminübersicht konnte gerade nicht geladen werden. '
      + 'Wochenenden und Feiertage sind berücksichtigt, einzelne bereits belegte Tage aber möglicherweise nicht. '
      + 'Ich bestätige jeden Termin per E-Mail.';
    hinweis.hidden = false;
  }

  const anfrage = richteAnfrageEin({
    bereich: document.getElementById('anfrage'),
    vorher: document.getElementById('anfrage-vorher'),
  });

  erstelleKalender(wurzel, {
    gesperrt: daten.gesperrt,
    beiAuswahl: (datum) => anfrage.zeigeFuer(datum),
  });
}

document.querySelectorAll('[data-kopieren]').forEach((knopf) => {
  const quelle = document.getElementById(knopf.dataset.kopieren);
  const meldung = document.getElementById(`${knopf.dataset.kopieren}-meldung`);
  if (quelle && meldung) richteKopierknopfEin(knopf, quelle, meldung);
});
