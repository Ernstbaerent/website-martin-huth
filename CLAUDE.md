# CLAUDE.md – Website Dr. Martin Huth · die IT-Profis

Diese Datei hält die festen Regeln des Projekts fest. Sie gilt für jede Sitzung.

## Zusammenarbeit
- Auftraggeber im Repo: Clemens (baut die Seite für seinen Vater Dr. Martin Huth).
- Mit Clemens auf Deutsch sprechen und ihn duzen. Rolle: Entwickler-Coach – erklären, was passiert und warum.
- In Etappen arbeiten. Vor jeder Etappe kurz sagen WAS und WARUM, danach das Ergebnis zeigen und auf Clemens' OK warten.
- Auf dem Arbeitsbranch arbeiten, kleine Commits, verständliche deutsche Commit-Nachrichten.
- Nichts nach `main` übernehmen ohne Clemens' OK.
- `_referenz/` erst in Etappe 5 löschen und nur nach ausdrücklicher Rückfrage.

## Etappen
0. Planen, diese CLAUDE.md anlegen.
1. Logo: modernisierte SVG-Fassung des bestehenden Logos, zwei Richtungen, Clemens wählt.
2. Grundgerüst und Design des Onepagers mit allen Inhalten (+ Impressum/Datenschutz als Gerüst).
3. Öffentlicher Kalender und Terminanfrage.
4. Verwaltungsseite.
5. Feinschliff, Handy-Breiten, Barrierefreiheit. Danach `_referenz/` löschen (vorher fragen).

## Inhalt und Ton
- Auftritt: „Training · Consulting · Projektmanagement – die IT-Profis".
- Zielgruppe: IT-Entscheider im öffentlichen Dienst, kommen meist per QR-Code von der Visitenkarte, oft am Handy.
- Website-Texte in Sie-Form, sachlich.
- Fakten zur Person nur aus dem Briefing: Dr. rer. nat. (Mathematik), über 15 Jahre Leiter der IT einer Landesbehörde,
  Microsoft Certified Trainer seit 1997, CompTIA Project+, Six Sigma Green Belt, früher Trainingsleitung bei Dell,
  pädagogischer Leiter in der Weiterbildung. Heute im Ruhestand, freiberuflich tätig.
- Den aktuellen/letzten Arbeitgeber NIE namentlich nennen – nur „Landesbehörde".
- NICHTS erfinden: keine Kundennamen, Referenzen, Zahlen, Kundenstimmen, Rechtstexte.
  Fehlendes immer als `[Platzhalter in eckigen Klammern]`.
- Kontakt-E-Mail: martin@huhts.de. LinkedIn, Xing, Telefon: Platzhalter.

## Logo
- Vorlage: bestehendes Logo (Oval mit senkrecht gestapeltem „T C P", daneben „IP" in blauem Kasten).
- Nur behutsam modernisieren: Aufbau und Wiedererkennung bleiben; flach, keine Schatten, keine Schrägen, klare Linien.
- KEIN neues oder anderes Logo erfinden. Muss sehr klein funktionieren (Favicon, Visitenkarte).
- Varianten der gewählten Richtung: Bildmarke, Bildmarke + Claim, einfarbig dunkel, weiß auf dunklem Grund,
  Favicon als SVG + PNG 32×32 und 180×180.

## Design
- Heller, grau-weißer Grund; dezente Platinen-Linien (Leiterbahnen, kleine Knoten/Chips) als Inline-SVG, sparsam
  (Kopfbereich, Trenner). Logo-Blau als Akzentfarbe. Claim mit den drei Leistungen als wiederkehrendes Element.
- Zeitgemäß, ruhig, seriös, viel Weißraum. Nicht verspielt, kein 90er-IT-Look, kein Behörden-Grau. Mobile first.
- Keine Stockfotos, keine Fotos als Deko. Platzhalter für ein Porträtfoto.
- Schrift: frei lizenziert, selbst gehostet (woff2 in `assets/fonts/` + Lizenzdatei). Calibri NICHT verwenden.

## Technik
- Reines HTML, CSS, JavaScript. Kein Framework, kein Build-Schritt, keine Paketabhängigkeiten zur Laufzeit.
- JavaScript als ES-Module (`<script type="module">`), damit dieselben Dateien im Browser und in Node-Tests laufen.
- Hosting: GitHub Pages aus `main`, Root. (Pages, CNAME, Domain/DNS bei Strato, Visitenkarten: bewusst noch NICHT.)
- Getrennte Dateien: `js/kalender.js`, `js/feiertage.js`, `js/anfrage.js`, `js/verwaltung.js`.
- `data/verfuegbarkeit.json` enthält nur gesperrte Tage/Zeiträume – NIE einen Grund (das Repo ist öffentlich).
- Verwaltungsseite in nicht erratbarem Ordner, nirgends verlinkt, `<meta name="robots" content="noindex, nofollow">`,
  NICHT in robots.txt oder Sitemap erwähnen.

## Datenschutz und Sicherheit
- Die öffentliche Seite lädt nichts von Dritten: keine Google Fonts, keine CDNs, keine externen Bilder/Skripte,
  kein Tracking, keine Cookies.
- Einzige externe Verbindung im ganzen Projekt: die Verwaltungsseite zu `api.github.com`.
- Terminanfragen: Die Website speichert oder überträgt KEINE Anfragedaten. Versand per `mailto:`,
  gekapselt in `js/anfrage.js`, damit er später gegen einen Server-Dienst austauschbar ist.
- GitHub-Zugangsschlüssel nur im localStorage des Geräts, nie im Code oder Repo.
- Keine Schlüssel, Passwörter oder personenbezogenen Daten im Repo.

## Barrierefreiheit
- Kontraste nach WCAG AA, Fließtext mindestens 18 px, saubere Überschriften-Hierarchie, Alt-Texte, sichtbarer Fokus.
- Kalender per Tastatur bedienbar, sinnvolle ARIA-Labels, Tippflächen mindestens 44×44 px.

## Fachregeln Kalender
- Monatsansicht, blättern bis höchstens 12 Monate voraus, Legende.
- Gesperrt (ausgegraut, nicht anklickbar): Sa, So, vergangene Tage, alle Feiertage (bundesweit + regional, s. u.),
  Einträge aus `verfuegbarkeit.json`. Gesperrte Tage zeigen nur „nicht verfügbar", NIE einen Grund.
- Übrige Werktage: „verfügbar", dezent im Akzentblau.
- `verfuegbarkeit.json` per fetch mit Cache-Busting laden; bei Fehler trotzdem mit Wochenenden und Feiertagen anzeigen.
- Feiertage komplett lokal, Ostern per Gaußscher Osterformel. Bundesweit: Neujahr, Karfreitag, Ostermontag, 1. Mai,
  Christi Himmelfahrt, Pfingstmontag, Tag der Deutschen Einheit, 1. und 2. Weihnachtstag. Regional (ebenfalls gesperrt):
  Heilige Drei Könige, Frauentag (8.3.), Fronleichnam, Mariä Himmelfahrt, Weltkindertag (20.9.), Reformationstag,
  Allerheiligen, Buß- und Bettag (Mittwoch vor dem 23.11.).
- Pflicht-Testwerte: Ostersonntag 2026 = 05.04.2026, 2027 = 28.03.2027, Fronleichnam 2026 = 04.06.2026,
  Buß- und Bettag 2026 = 18.11.2026. Tests: `node tests/feiertage.test.mjs`.

## Terminanfrage
- Klick auf verfügbaren Tag → Formular: Name, Organisation, E-Mail, Telefon (optional), Anliegen.
- Button „Anfrage für [Datum] senden" → mailto an martin@huhts.de.
- Betreff: „Terminanfrage: [Wochentag, TT.MM.JJJJ] – [Organisation]". Mailtext enthält alle Formulardaten übersichtlich.
- Hinweis: „Ihre Anfrage ist unverbindlich. Ich bestätige den Termin per E-Mail." + E-Mail-Adresse mit Kopier-Button.

## Verwaltungsseite
- Für Martin Huth, ohne Technikkenntnisse sofort verständlich, auch am Handy; gleicher Stil, aber schlicht.
- Anmeldung per fine-grained GitHub-Token (nur dieses Repo, nur „Contents: Read and write"), gespeichert im localStorage;
  „Abmelden" löscht ihn.
- Kalender wie öffentlich; Tage und Zeiträume sperren/freigeben; Liste aller Einträge, einzeln löschbar.
- „Speichern" schreibt `data/verfuegbarkeit.json` über die GitHub-Contents-API nach `main` (mit aktuellem sha,
  Konflikte abfangen). Erfolg: „Gespeichert – in wenigen Minuten online." Fehler verständlich auf Deutsch
  (z. B. „Schlüssel abgelaufen – bitte Clemens melden").
- Hinweis: „Terminanfragen erhalten Sie per E-Mail an martin@huhts.de."

## Getroffene Entscheidungen
- Logo: Richtung A „nah am Original“, Linien und Buchstaben in Dunkelblau #17375E, Flächen Hellblau #95C6E6.
  Dateien in `assets/logo/` (logo, logo-claim, logo-dunkel, logo-weiss, logo-claim-weiss), Favicon in `assets/favicon/`
  (IP-Kasten). Buchstaben sind als Pfade eingebettet (aus Source Sans 3 Black).
- Schrift: Source Sans 3 (400, 600, 700, Zeichensatz latin) in `assets/fonts/`, Lizenz `OFL.txt`.
- Farben, Schriftgrößen und Abstände stehen als Variablen oben in `css/stil.css` – dort ändern, nicht verstreut.
- Akzent für Text/Links: #1F5F94 (Logo-Blau abgedunkelt für AA-Kontrast); Hellblau nur für Flächen und Linien.
- Verwaltungsseite: Ordner `kalender-pflege-76135ab6/`.
- Platinen-Motiv: Leiterbahnen gehen vom Porträtrahmen aus; dazu ein schmaler Trenner mit Chip.
- Jede Seite hat eine Content-Security-Policy (`<meta http-equiv>`), die nur eigene Dateien erlaubt.
