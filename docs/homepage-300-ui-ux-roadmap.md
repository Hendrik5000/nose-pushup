# Alo-Homepage: 300 UI/UX-Verbesserungen

Stand: 20.11.2026. Basis ist der nach PR #223 gemergte One-UI-artige App-Launcher.

## Leitplanken
Anthrazit/Navy mit Eisblau als Akzent; vorhandene sechs Designstile und 13 Farbwelten bleiben erhalten. Squircle-Icons, kontrolliertes Glassmorphism und dezente Tiefe. Kein Dashboard-Umbau, keine neue Farbpalette, keine Datenbankmigration. Mira und System-Home-Bar bleiben erhalten.

## In diesem Implementierungsbatch umgesetzt
- Visuelle Tokens für Launcher-Text, Akzent und Oberflächen ergänzt.
- Header-Aktionen und Gruppensteuerung optisch vereinheitlicht.
- App-Kacheln, Icon-Flächen und Labels visuell verfeinert.
- Widgets mit ruhiger Navy-Fläche, Kontur und kontrolliertem Blur gestaltet.
- Bearbeitungskarten und Wallpaper-Overlay strukturiert.
- Fokus-, Drop-Ziel-, Reduced-Motion- und Forced-Colors-Zustände ergänzt bzw. präzisiert.
- Kompakte Regeln für schmale und niedrige Viewports ergänzt.

Die folgenden 300 Punkte bilden den vollständigen Prüf- und Verbesserungs-Backlog. Sie sind nicht automatisch alle bereits implementiert; weitere Umsetzungsbatches sollen sie einzeln prüfen und abhaken.

## Visuelle Hierarchie

1. Alo-Titel als primären Anker stärken
2. Widgets optisch unter die App-Ebene ordnen
3. App-Gruppen mit konsistenten Abständen gliedern
4. Primäre Aktionen visuell priorisieren
5. Sekundäre Aktionen zurückhaltend darstellen
6. Freiflächen als Ruhebereiche nutzen
7. Vertikale Rhythmik vereinheitlichen
8. Kanten und Ausrichtungen angleichen
9. Unnötige Rahmen reduzieren
10. Kartenebenen klar unterscheiden
11. Kontrast zwischen Vorder- und Hintergrund erhöhen
12. Überschriften von App-Namen absetzen
13. Wiederkehrende Abstände standardisieren
14. Inhalte auf klare Achsen ausrichten
15. Überladene Bereiche sinnvoll gruppieren
16. Statusinfos näher an Auslöser setzen
17. Dekoration nur zur Orientierung einsetzen
18. Visuelle Dichte pro Gerät abstimmen
19. Tiefenstaffelung konsistent halten
20. Startbereich ohne Dashboard-Optik erhalten

## Farben und Oberflächen

21. Anthrazit als Grundfläche stabilisieren
22. Navy für sekundäre Flächen einsetzen
23. Eisblau als Akzent begrenzen
24. Textkontrast systematisch prüfen
25. Glasflächen kontrolliert transparent halten
26. Blur und Schatten nicht überladen
27. Rahmenfarben vereinheitlichen
28. Aktive Zustände konsistent markieren
29. Inaktive Elemente zurückhaltend zeigen
30. Fehlerfarben semantisch nutzen
31. Erfolgsfarben nicht dekorativ einsetzen
32. Wallpaper mit lesbarem Overlay absichern
33. Helle Presets auf Kontrast testen
34. Verläufe nur zur Ebenentrennung nutzen
35. Farbintensität auf kleinen Screens reduzieren
36. Widget-Transparenz angleichen
37. Fokus- und Hoverfarben unterscheiden
38. Farben zentral als Tokens definieren
39. Forced-Colors respektieren
40. Bestehende Farbwelten unverändert erhalten

## Typografie

41. Einheitliche Schriftfamilie verwenden
42. Titelgrößen responsiv skalieren
43. App-Namen auf zwei Zeilen begrenzen
44. Zeilenhöhen kleiner Labels optimieren
45. Titel und Metadaten typografisch abstufen
46. Lange deutsche Wörter kontrolliert umbrechen
47. Kachelbeschriftungen zentrieren
48. Widget-Titel kompakt halten
49. Widget-Inhalte luftig setzen
50. Zahlen tabellarisch ausrichten
51. Sekundärtexte kontrastreicher gestalten
52. Mindestschriftgrößen einhalten
53. Versalien-Abstände reduzieren
54. Text-Balance bei zweizeiligen Titeln nutzen
55. Ellipsen nur bei langen Inhalten einsetzen
56. Tooltip-Texte verständlich formulieren
57. Beschriftungen nicht nur farblich unterscheiden
58. Dynamische Schriftgrößen berücksichtigen
59. Touchlabels konsistent gewichten
60. Wallpapers auf Lesbarkeit testen

## App-Icons

61. Squircle-Geometrie vereinheitlichen
62. Icon-Radien angleichen
63. SVG-Grafiken sauber beschneiden
64. Bild-Icons verzerrungsfrei skalieren
65. Icon-Innenabstände abstimmen
66. Kachelfläche vom Icon trennen
67. Schatten harmonisieren
68. Konturen heller Motive verstärken
69. Icons auf dunklen Wallpapers prüfen
70. Labels mittig ausrichten
71. Badges nicht über Motive legen
72. Große Badge-Zahlen begrenzen
73. Große Kacheln ausbalancieren
74. Kleine Kacheln mit Touchfläche versehen
75. Press-Feedback dezent animieren
76. Hover nur auf Mausgeräten aktivieren
77. Fehlende Artworks mit Fallback zeigen
78. Marketplace-Icons angleichen
79. Artwork-Größen dokumentieren
80. Neue Icons gegen Alo-Stil prüfen

## App-Raster

81. Spaltenzahl an Viewport anpassen
82. Horizontale Rasterabstände angleichen
83. Vertikale Abstände abstimmen
84. Raster bei Zoom ohne Überlauf halten
85. Große Kacheln ohne Lückenchaos platzieren
86. Tablets gezielt dichter belegen
87. Seitenindikatoren mittig ausrichten
88. Aktive Seite eindeutig markieren
89. Tastatur-Seitenwechsel unterstützen
90. Touch-Seitenwechsel konfliktfrei gestalten
91. Leere letzte Seiten vermeiden
92. Drag-Reihenfolge stabil speichern
93. Gruppen nicht unnötig zerreißen
94. Sehr schmale Geräte testen
95. Querformat separat optimieren
96. Große Displays nicht überfüllen
97. Rasterhöhe bei kurzen Viewports begrenzen
98. Drop-Ziele klar markieren
99. App-Anzahl pro Seite begrenzen
100. Layout bei vielen Apps stabil halten

## Widgets

101. Widget-Größen optisch vereinheitlichen
102. Titel und Inhalt klar trennen
103. Ruhige Verläufe verwenden
104. Kartenradien standardisieren
105. Höhe am Inhalt ausrichten
106. Lange Texte begrenzen
107. Links als Aktionen gestalten
108. Fokuszustände sichtbar machen
109. Editierbarkeit klar signalisieren
110. Widget-Reihenfolge ohne Sprünge ändern
111. Kleine Screens stapeln
112. Tablet-Spalten erweitern
113. Leere Zustände erklären
114. Ladezustände darstellen
115. Fehlerzustände pro Widget begrenzen
116. Datenalter dynamischer Werte zeigen
117. Zahlen und Einheiten formatieren
118. Kontrast auf Wallpapers absichern
119. Animationen reduzieren
120. Entfernen mit Undo planen

## Header und Navigation

121. Header-Höhe angleichen
122. Suche als Touchziel gestalten
123. Postfach-Badge sichtbar halten
124. Freunde-Aktion klar beschriften
125. Profilbild-Fallback gestalten
126. Header-Icons gleich gewichten
127. Touchziele mindestens 44 Pixel groß halten
128. Header vor Überlauf schützen
129. Fokusreihenfolge logisch halten
130. Press-Feedback ergänzen
131. Suchdialog konsistent gestalten
132. Aktiven Kontext kenntlich machen
133. Home-Bar-Abstand berücksichtigen
134. Doppelte Navigation vermeiden
135. Landscape-Header neu verteilen
136. Avatar-Rand sichtbar halten
137. Desktop-Tooltips ergänzen
138. ARIA-Namen funktionsbezogen setzen
139. Wallpaper-Kontrast testen
140. Header bei geringer Höhe kompakt halten

## Bearbeitungsmodus

141. Edit-Modus eindeutig signalisieren
142. Kachelränder vereinheitlichen
143. Drag-Quelle hervorheben
144. Drop-Ziel mit Richtung anzeigen
145. Tastatur-Aufnahmezustand zeigen
146. Abbrechen jederzeit ermöglichen
147. Änderungen bestätigen
148. Umbenennen fokussieren
149. Standardname sekundär darstellen
150. Hintergrundauswahl als Vorschau zeigen
151. Ausgewähltes Preset markieren
152. Upload-Status anzeigen
153. Fehler neben Feld platzieren
154. Lange Edit-Formulare gliedern
155. Speicherfehler ohne Sprung zeigen
156. Edit-Panel mobil verbreitern
157. Hilfe kurz und scannbar halten
158. Tastaturaktionen erreichbar halten
159. Drop-Ziele farbunabhängig markieren
160. Edit-Modus sauber beenden

## Touch und Gesten

161. Long-Press-Schwelle konsistent halten
162. Bewegung vor Long-Press abbrechen
163. Vertikales Scrollen nicht blockieren
164. Swipe-Schwelle abstimmen
165. Pointer-Cancel behandeln
166. Drag-Vorschau am Finger ausrichten
167. Touchziele entzerren
168. Doppeltippen nicht unbeabsichtigt auslösen
169. Scrollposition stabil halten
170. Touchfeedback zeitnah zeigen
171. Gestenhinweise kontextuell anzeigen
172. Maus- und Touch-Drag angleichen
173. Stift-Eingabe unterstützen
174. Kontextmenüs angleichen
175. Reduced Motion bei Gesten respektieren
176. Screenreader-Alternative zu Drag bieten
177. Horizontal-Swipe in Widgets vermeiden
178. Swipe-Distanz klar definieren
179. Klick nach Long-Press unterdrücken
180. Gesten nie als einzige Bedienung nutzen

## Animationen

181. Press-Animation kurz halten
182. Hover nur für Mausgeräte nutzen
183. Widget-Hover subtil gestalten
184. Seitenwechsel weich darstellen
185. Aktive Seitenanzeige sanft animieren
186. Drag-Übergänge kurz halten
187. Keine Daueranimationen einsetzen
188. Reduced Motion respektieren
189. Schwache Geräte entlasten
190. Layoutverschiebungen vermeiden
191. Fokuswechsel nicht animiert ablenken
192. Modal-Übergänge vereinheitlichen
193. Fehler nicht blinken lassen
194. Erfolgsfeedback kurz halten
195. Kein erzwungenes Smooth-Scrolling
196. Animationen nicht mit Touch konkurrieren lassen
197. Widget-Bewegung begrenzen
198. Icon-Skalierung ohne Textspringen
199. Drag-Ende rückmelden
200. Energiesparmodus berücksichtigen

## Responsive Ansichten

201. Schmale Smartphones testen
202. Breite Smartphones mit Spalten nutzen
203. Tablets im Querformat abstimmen
204. Desktop-Breite begrenzen
205. Ultrabreite Ansichten zentrieren
206. Kleine Höhen kompakt behandeln
207. Landscape-Widgets umbrechen
208. Safe-Area respektieren
209. Zoom bis 200 Prozent unterstützen
210. Dynamische Viewporthöhe nutzen
211. Tastatur-Überdeckung behandeln
212. iPad-Touchziele prüfen
213. Split-Screen berücksichtigen
214. Kleine Fenster ohne Scrollen zeigen
215. Labels bei 320 Pixeln testen
216. Widgets bei 360 Pixeln prüfen
217. Hover nicht auf Touch simulieren
218. Breakpoints dokumentieren
219. Orientierungswechsel ohne Datenverlust
220. Responsive Regressionstests ergänzen

## Hintergründe

221. Standardhintergrund abstimmen
222. Eigene Bilder abdunkeln
223. Preset-Vorschauen vereinheitlichen
224. Ausgewähltes Wallpaper markieren
225. Hochformat-Position optimieren
226. Querformat-Position optimieren
227. Bild ohne Verzerrung skalieren
228. Upload-Vorschau zeigen
229. Große Bilder verkleinern
230. Overlay-Transparenz abstimmen
231. Textkontrast prüfen
232. Wallpaper-Wechsel ruhig gestalten
233. Defektes Bild mit Fallback zeigen
234. Hintergrund-Reset anbieten
235. Dateiformate erklären
236. Upload-Fehler konkret benennen
237. Keine neue Farbwelt einführen
238. OLED-Darstellung prüfen
239. Mira-Button abheben
240. Hintergrundsteuerung mobil verdichten

## Barrierefreiheit

241. Alle Aktionen per Tastatur erreichen
242. Fokusindikatoren kontrastreich gestalten
243. Überschriftenhierarchie sichern
244. Screenreader-Namen prüfen
245. ARIA-expanded korrekt setzen
246. ARIA-current korrekt nutzen
247. Tastatur-Drag vollständig abbilden
248. Drop-Ziele ohne Farbe unterscheiden
249. Touchziele groß halten
250. Textkontrast nach WCAG prüfen
251. Reduced Motion global beachten
252. Forced Colors unterstützen
253. Zoom ohne Abschneiden ermöglichen
254. Fokus nicht hinter Overlays verlieren
255. Fehler mit role-alert ausgeben
256. Statusmeldungen screenreaderfreundlich machen
257. Labels visuell und semantisch bereitstellen
258. Tab-Reihenfolge angleichen
259. Dialog-Fokus verwalten
260. Dekorative Icons ausblenden

## Zustände und Feedback

261. Ladezustände dynamischer Daten zeigen
262. Leere Gruppen erklären
263. Fehler auf Bereich begrenzen
264. Speicherbestätigung anzeigen
265. Offline-Zustand kenntlich machen
266. Veraltete Widget-Daten markieren
267. Such-Ladezustand darstellen
268. Keine Treffer erklären
269. Upload-Fortschritt zeigen
270. Deinstallation bestätigen
271. Undo für reversible Aktionen anbieten
272. Wiederholen bei Fehler ermöglichen
273. Disabled-Zustände eindeutig gestalten
274. Aktiv und Favorit unterscheiden
275. Null-Badges ausblenden
276. Große Badge-Zahlen kompakt formatieren
277. Netzwerkfehler nicht als leere Daten tarnen
278. Statusmeldungen ausblenden
279. Fehlertexte in Alltagssprache schreiben
280. Erfolg nicht nur grün markieren

## Performance und Qualität

281. Icon-Bilder mit festen Maßen laden
282. Layoutverschiebungen vermeiden
283. Wallpaper optimieren
284. Blur auf Mobilgeräten begrenzen
285. CSS-Selektoren scopen
286. GPU-freundliche Animationen nutzen
287. Widgets bedarfsgerecht aktualisieren
288. Viele Erweiterungen stabil darstellen
289. Lange App-Listen effizient rendern
290. Dekorative SVGs schlank halten
291. Schwere Schatten mobil reduzieren
292. OLED-Kontrast testen
293. Dynamische Schrift robust darstellen
294. Fehlergrenzen pro Bereich erhalten
295. Keine Deko-Abhängigkeiten hinzufügen
296. CSS-Duplikate später zusammenführen
297. Responsive Regeln dokumentieren
298. Visuelle Regressionstests ergänzen
299. Touch- und Tastaturtests automatisieren
300. Reale Geräte vor Release prüfen
