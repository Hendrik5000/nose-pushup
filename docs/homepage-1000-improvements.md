# Alo-Homepage: 1.000 zusätzliche Verbesserungsprüfungen

Stand: 20.11.2026. Diese Liste erweitert die 300-Punkte-Roadmap. Sie ist ein systematischer, prüfbarer Backlog mit 20 Bereichen und 50 konkreten Prüfungen je Bereich. Die Varianten unterscheiden reale Geräte- und Viewport-Kontexte. Ein Eintrag gilt erst nach Umsetzung und Test als erledigt.

## Design- und Funktionsgrenzen
- One-UI-artiger Launcher bleibt erhalten; kein Dashboard-Umbau.
- Anthrazit/Navy und Eisblau, sechs vorhandene Stile und 13 Farbwelten bleiben bestehen.
- Squircle-Icons, App-Seiten, Favoriten, Gruppen, Widgets, gespeicherte Layouts, Mira und System-Home-Bar bleiben erhalten.
- Keine Datenbankänderung und keine neue UI-Abhängigkeit in diesem Batch.

## Bereits in diesem Code-Batch umgesetzt
- Robusteres Layout- und Text-Overflow-Verhalten.
- Stabilere App-Kachel- und Icon-Geometrie.
- Bessere Widget-Fokuszustände und Scrollbarkeit der Seitenindikatoren.
- Deutlichere Disabled-, Fokus- und Formularzustände.
- Optimierungen für sehr schmale Geräte, Tablets, Desktop und Landscape.
- Unterstützung für Reduced Motion, Reduced Transparency, High Contrast und Forced Colors.
- Druckansicht und Touch-/Pointer-Verhalten präzisiert.

**Wichtig:** Die 1.000 Einträge sind nicht alle automatisch implementiert. Der Code-Batch setzt die oben genannten risikoarmen UI-Verbesserungen um; jeder weitere Eintrag muss anhand der bestehenden Komponenten geprüft, programmiert und getestet werden, bevor er als erledigt markiert wird.

## Layout und Hierarchie

1. Abstände zwischen Hauptbereichen harmonisieren – auf 320–359 px Smartphone-Breite.
2. Abstände zwischen Hauptbereichen harmonisieren – auf 360–429 px Smartphone-Breite.
3. Abstände zwischen Hauptbereichen harmonisieren – auf großen Smartphones ab 430 px.
4. Abstände zwischen Hauptbereichen harmonisieren – auf Tablets im Hochformat.
5. Abstände zwischen Hauptbereichen harmonisieren – auf Tablets und Desktop im Querformat.
6. Kopfbereich klar vom Launcher-Inhalt trennen – auf 320–359 px Smartphone-Breite.
7. Kopfbereich klar vom Launcher-Inhalt trennen – auf 360–429 px Smartphone-Breite.
8. Kopfbereich klar vom Launcher-Inhalt trennen – auf großen Smartphones ab 430 px.
9. Kopfbereich klar vom Launcher-Inhalt trennen – auf Tablets im Hochformat.
10. Kopfbereich klar vom Launcher-Inhalt trennen – auf Tablets und Desktop im Querformat.
11. Widget-Bereich optisch sekundär halten – auf 320–359 px Smartphone-Breite.
12. Widget-Bereich optisch sekundär halten – auf 360–429 px Smartphone-Breite.
13. Widget-Bereich optisch sekundär halten – auf großen Smartphones ab 430 px.
14. Widget-Bereich optisch sekundär halten – auf Tablets im Hochformat.
15. Widget-Bereich optisch sekundär halten – auf Tablets und Desktop im Querformat.
16. App-Gruppen mit konsistenten Überschriften gliedern – auf 320–359 px Smartphone-Breite.
17. App-Gruppen mit konsistenten Überschriften gliedern – auf 360–429 px Smartphone-Breite.
18. App-Gruppen mit konsistenten Überschriften gliedern – auf großen Smartphones ab 430 px.
19. App-Gruppen mit konsistenten Überschriften gliedern – auf Tablets im Hochformat.
20. App-Gruppen mit konsistenten Überschriften gliedern – auf Tablets und Desktop im Querformat.
21. Ausrichtung der linken und rechten Kanten vereinheitlichen – auf 320–359 px Smartphone-Breite.
22. Ausrichtung der linken und rechten Kanten vereinheitlichen – auf 360–429 px Smartphone-Breite.
23. Ausrichtung der linken und rechten Kanten vereinheitlichen – auf großen Smartphones ab 430 px.
24. Ausrichtung der linken und rechten Kanten vereinheitlichen – auf Tablets im Hochformat.
25. Ausrichtung der linken und rechten Kanten vereinheitlichen – auf Tablets und Desktop im Querformat.
26. Leerräume gezielt statt zufällig einsetzen – auf 320–359 px Smartphone-Breite.
27. Leerräume gezielt statt zufällig einsetzen – auf 360–429 px Smartphone-Breite.
28. Leerräume gezielt statt zufällig einsetzen – auf großen Smartphones ab 430 px.
29. Leerräume gezielt statt zufällig einsetzen – auf Tablets im Hochformat.
30. Leerräume gezielt statt zufällig einsetzen – auf Tablets und Desktop im Querformat.
31. Inhaltsbreite auf großen Bildschirmen begrenzen – auf 320–359 px Smartphone-Breite.
32. Inhaltsbreite auf großen Bildschirmen begrenzen – auf 360–429 px Smartphone-Breite.
33. Inhaltsbreite auf großen Bildschirmen begrenzen – auf großen Smartphones ab 430 px.
34. Inhaltsbreite auf großen Bildschirmen begrenzen – auf Tablets im Hochformat.
35. Inhaltsbreite auf großen Bildschirmen begrenzen – auf Tablets und Desktop im Querformat.
36. Kartenebenen visuell unterscheidbar machen – auf 320–359 px Smartphone-Breite.
37. Kartenebenen visuell unterscheidbar machen – auf 360–429 px Smartphone-Breite.
38. Kartenebenen visuell unterscheidbar machen – auf großen Smartphones ab 430 px.
39. Kartenebenen visuell unterscheidbar machen – auf Tablets im Hochformat.
40. Kartenebenen visuell unterscheidbar machen – auf Tablets und Desktop im Querformat.
41. Überfüllte Bereiche aufteilen – auf 320–359 px Smartphone-Breite.
42. Überfüllte Bereiche aufteilen – auf 360–429 px Smartphone-Breite.
43. Überfüllte Bereiche aufteilen – auf großen Smartphones ab 430 px.
44. Überfüllte Bereiche aufteilen – auf Tablets im Hochformat.
45. Überfüllte Bereiche aufteilen – auf Tablets und Desktop im Querformat.
46. Vertikalen Rhythmus pro Abschnitt definieren – auf 320–359 px Smartphone-Breite.
47. Vertikalen Rhythmus pro Abschnitt definieren – auf 360–429 px Smartphone-Breite.
48. Vertikalen Rhythmus pro Abschnitt definieren – auf großen Smartphones ab 430 px.
49. Vertikalen Rhythmus pro Abschnitt definieren – auf Tablets im Hochformat.
50. Vertikalen Rhythmus pro Abschnitt definieren – auf Tablets und Desktop im Querformat.

## Farben und Oberflächen

51. Anthrazit-Grundfläche auf Kontrast prüfen – auf 320–359 px Smartphone-Breite.
52. Anthrazit-Grundfläche auf Kontrast prüfen – auf 360–429 px Smartphone-Breite.
53. Anthrazit-Grundfläche auf Kontrast prüfen – auf großen Smartphones ab 430 px.
54. Anthrazit-Grundfläche auf Kontrast prüfen – auf Tablets im Hochformat.
55. Anthrazit-Grundfläche auf Kontrast prüfen – auf Tablets und Desktop im Querformat.
56. Navy-Oberflächen nach Ebenentiefe staffeln – auf 320–359 px Smartphone-Breite.
57. Navy-Oberflächen nach Ebenentiefe staffeln – auf 360–429 px Smartphone-Breite.
58. Navy-Oberflächen nach Ebenentiefe staffeln – auf großen Smartphones ab 430 px.
59. Navy-Oberflächen nach Ebenentiefe staffeln – auf Tablets im Hochformat.
60. Navy-Oberflächen nach Ebenentiefe staffeln – auf Tablets und Desktop im Querformat.
61. Eisblau nur für Interaktion und Fokus nutzen – auf 320–359 px Smartphone-Breite.
62. Eisblau nur für Interaktion und Fokus nutzen – auf 360–429 px Smartphone-Breite.
63. Eisblau nur für Interaktion und Fokus nutzen – auf großen Smartphones ab 430 px.
64. Eisblau nur für Interaktion und Fokus nutzen – auf Tablets im Hochformat.
65. Eisblau nur für Interaktion und Fokus nutzen – auf Tablets und Desktop im Querformat.
66. Rahmenfarben vereinheitlichen – auf 320–359 px Smartphone-Breite.
67. Rahmenfarben vereinheitlichen – auf 360–429 px Smartphone-Breite.
68. Rahmenfarben vereinheitlichen – auf großen Smartphones ab 430 px.
69. Rahmenfarben vereinheitlichen – auf Tablets im Hochformat.
70. Rahmenfarben vereinheitlichen – auf Tablets und Desktop im Querformat.
71. Transparenz von Widgets konsistent halten – auf 320–359 px Smartphone-Breite.
72. Transparenz von Widgets konsistent halten – auf 360–429 px Smartphone-Breite.
73. Transparenz von Widgets konsistent halten – auf großen Smartphones ab 430 px.
74. Transparenz von Widgets konsistent halten – auf Tablets im Hochformat.
75. Transparenz von Widgets konsistent halten – auf Tablets und Desktop im Querformat.
76. Schattenstärken reduzieren und angleichen – auf 320–359 px Smartphone-Breite.
77. Schattenstärken reduzieren und angleichen – auf 360–429 px Smartphone-Breite.
78. Schattenstärken reduzieren und angleichen – auf großen Smartphones ab 430 px.
79. Schattenstärken reduzieren und angleichen – auf Tablets im Hochformat.
80. Schattenstärken reduzieren und angleichen – auf Tablets und Desktop im Querformat.
81. Blur bei Lesbarkeitseinbußen abschalten – auf 320–359 px Smartphone-Breite.
82. Blur bei Lesbarkeitseinbußen abschalten – auf 360–429 px Smartphone-Breite.
83. Blur bei Lesbarkeitseinbußen abschalten – auf großen Smartphones ab 430 px.
84. Blur bei Lesbarkeitseinbußen abschalten – auf Tablets im Hochformat.
85. Blur bei Lesbarkeitseinbußen abschalten – auf Tablets und Desktop im Querformat.
86. Fehlerfarben semantisch einsetzen – auf 320–359 px Smartphone-Breite.
87. Fehlerfarben semantisch einsetzen – auf 360–429 px Smartphone-Breite.
88. Fehlerfarben semantisch einsetzen – auf großen Smartphones ab 430 px.
89. Fehlerfarben semantisch einsetzen – auf Tablets im Hochformat.
90. Fehlerfarben semantisch einsetzen – auf Tablets und Desktop im Querformat.
91. Ausgewählte Zustände ohne Farbcode erkennbar machen – auf 320–359 px Smartphone-Breite.
92. Ausgewählte Zustände ohne Farbcode erkennbar machen – auf 360–429 px Smartphone-Breite.
93. Ausgewählte Zustände ohne Farbcode erkennbar machen – auf großen Smartphones ab 430 px.
94. Ausgewählte Zustände ohne Farbcode erkennbar machen – auf Tablets im Hochformat.
95. Ausgewählte Zustände ohne Farbcode erkennbar machen – auf Tablets und Desktop im Querformat.
96. Alle sechs Themes gegen dieselben Kontrastziele testen – auf 320–359 px Smartphone-Breite.
97. Alle sechs Themes gegen dieselben Kontrastziele testen – auf 360–429 px Smartphone-Breite.
98. Alle sechs Themes gegen dieselben Kontrastziele testen – auf großen Smartphones ab 430 px.
99. Alle sechs Themes gegen dieselben Kontrastziele testen – auf Tablets im Hochformat.
100. Alle sechs Themes gegen dieselben Kontrastziele testen – auf Tablets und Desktop im Querformat.

## Typografie

101. Titelgrößen über Viewports abstimmen – auf 320–359 px Smartphone-Breite.
102. Titelgrößen über Viewports abstimmen – auf 360–429 px Smartphone-Breite.
103. Titelgrößen über Viewports abstimmen – auf großen Smartphones ab 430 px.
104. Titelgrößen über Viewports abstimmen – auf Tablets im Hochformat.
105. Titelgrößen über Viewports abstimmen – auf Tablets und Desktop im Querformat.
106. App-Namen mit stabiler Zeilenhöhe darstellen – auf 320–359 px Smartphone-Breite.
107. App-Namen mit stabiler Zeilenhöhe darstellen – auf 360–429 px Smartphone-Breite.
108. App-Namen mit stabiler Zeilenhöhe darstellen – auf großen Smartphones ab 430 px.
109. App-Namen mit stabiler Zeilenhöhe darstellen – auf Tablets im Hochformat.
110. App-Namen mit stabiler Zeilenhöhe darstellen – auf Tablets und Desktop im Querformat.
111. Zweizeilige Beschriftungen optisch zentrieren – auf 320–359 px Smartphone-Breite.
112. Zweizeilige Beschriftungen optisch zentrieren – auf 360–429 px Smartphone-Breite.
113. Zweizeilige Beschriftungen optisch zentrieren – auf großen Smartphones ab 430 px.
114. Zweizeilige Beschriftungen optisch zentrieren – auf Tablets im Hochformat.
115. Zweizeilige Beschriftungen optisch zentrieren – auf Tablets und Desktop im Querformat.
116. Lange deutsche Wörter sinnvoll umbrechen – auf 320–359 px Smartphone-Breite.
117. Lange deutsche Wörter sinnvoll umbrechen – auf 360–429 px Smartphone-Breite.
118. Lange deutsche Wörter sinnvoll umbrechen – auf großen Smartphones ab 430 px.
119. Lange deutsche Wörter sinnvoll umbrechen – auf Tablets im Hochformat.
120. Lange deutsche Wörter sinnvoll umbrechen – auf Tablets und Desktop im Querformat.
121. Widget-Titel von Inhalten abheben – auf 320–359 px Smartphone-Breite.
122. Widget-Titel von Inhalten abheben – auf 360–429 px Smartphone-Breite.
123. Widget-Titel von Inhalten abheben – auf großen Smartphones ab 430 px.
124. Widget-Titel von Inhalten abheben – auf Tablets im Hochformat.
125. Widget-Titel von Inhalten abheben – auf Tablets und Desktop im Querformat.
126. Sekundärtexte ausreichend kontrastieren – auf 320–359 px Smartphone-Breite.
127. Sekundärtexte ausreichend kontrastieren – auf 360–429 px Smartphone-Breite.
128. Sekundärtexte ausreichend kontrastieren – auf großen Smartphones ab 430 px.
129. Sekundärtexte ausreichend kontrastieren – auf Tablets im Hochformat.
130. Sekundärtexte ausreichend kontrastieren – auf Tablets und Desktop im Querformat.
131. Schriftgrößen bei Browserzoom stabil halten – auf 320–359 px Smartphone-Breite.
132. Schriftgrößen bei Browserzoom stabil halten – auf 360–429 px Smartphone-Breite.
133. Schriftgrößen bei Browserzoom stabil halten – auf großen Smartphones ab 430 px.
134. Schriftgrößen bei Browserzoom stabil halten – auf Tablets im Hochformat.
135. Schriftgrößen bei Browserzoom stabil halten – auf Tablets und Desktop im Querformat.
136. Versalien-Laufweite reduzieren – auf 320–359 px Smartphone-Breite.
137. Versalien-Laufweite reduzieren – auf 360–429 px Smartphone-Breite.
138. Versalien-Laufweite reduzieren – auf großen Smartphones ab 430 px.
139. Versalien-Laufweite reduzieren – auf Tablets im Hochformat.
140. Versalien-Laufweite reduzieren – auf Tablets und Desktop im Querformat.
141. Zahlen in Widgets tabellarisch ausrichten – auf 320–359 px Smartphone-Breite.
142. Zahlen in Widgets tabellarisch ausrichten – auf 360–429 px Smartphone-Breite.
143. Zahlen in Widgets tabellarisch ausrichten – auf großen Smartphones ab 430 px.
144. Zahlen in Widgets tabellarisch ausrichten – auf Tablets im Hochformat.
145. Zahlen in Widgets tabellarisch ausrichten – auf Tablets und Desktop im Querformat.
146. Text-Clamping ohne abgeschnittene Wortteile testen – auf 320–359 px Smartphone-Breite.
147. Text-Clamping ohne abgeschnittene Wortteile testen – auf 360–429 px Smartphone-Breite.
148. Text-Clamping ohne abgeschnittene Wortteile testen – auf großen Smartphones ab 430 px.
149. Text-Clamping ohne abgeschnittene Wortteile testen – auf Tablets im Hochformat.
150. Text-Clamping ohne abgeschnittene Wortteile testen – auf Tablets und Desktop im Querformat.

## Icons und Kacheln

151. Squircle-Radius über App-Typen angleichen – auf 320–359 px Smartphone-Breite.
152. Squircle-Radius über App-Typen angleichen – auf 360–429 px Smartphone-Breite.
153. Squircle-Radius über App-Typen angleichen – auf großen Smartphones ab 430 px.
154. Squircle-Radius über App-Typen angleichen – auf Tablets im Hochformat.
155. Squircle-Radius über App-Typen angleichen – auf Tablets und Desktop im Querformat.
156. Icon-Grafiken ohne Verzerrung skalieren – auf 320–359 px Smartphone-Breite.
157. Icon-Grafiken ohne Verzerrung skalieren – auf 360–429 px Smartphone-Breite.
158. Icon-Grafiken ohne Verzerrung skalieren – auf großen Smartphones ab 430 px.
159. Icon-Grafiken ohne Verzerrung skalieren – auf Tablets im Hochformat.
160. Icon-Grafiken ohne Verzerrung skalieren – auf Tablets und Desktop im Querformat.
161. SVG-Inhalte innerhalb der Maske beschneiden – auf 320–359 px Smartphone-Breite.
162. SVG-Inhalte innerhalb der Maske beschneiden – auf 360–429 px Smartphone-Breite.
163. SVG-Inhalte innerhalb der Maske beschneiden – auf großen Smartphones ab 430 px.
164. SVG-Inhalte innerhalb der Maske beschneiden – auf Tablets im Hochformat.
165. SVG-Inhalte innerhalb der Maske beschneiden – auf Tablets und Desktop im Querformat.
166. Bild-Fallbacks visuell vereinheitlichen – auf 320–359 px Smartphone-Breite.
167. Bild-Fallbacks visuell vereinheitlichen – auf 360–429 px Smartphone-Breite.
168. Bild-Fallbacks visuell vereinheitlichen – auf großen Smartphones ab 430 px.
169. Bild-Fallbacks visuell vereinheitlichen – auf Tablets im Hochformat.
170. Bild-Fallbacks visuell vereinheitlichen – auf Tablets und Desktop im Querformat.
171. Icon-Innenabstände pro Motiv prüfen – auf 320–359 px Smartphone-Breite.
172. Icon-Innenabstände pro Motiv prüfen – auf 360–429 px Smartphone-Breite.
173. Icon-Innenabstände pro Motiv prüfen – auf großen Smartphones ab 430 px.
174. Icon-Innenabstände pro Motiv prüfen – auf Tablets im Hochformat.
175. Icon-Innenabstände pro Motiv prüfen – auf Tablets und Desktop im Querformat.
176. Kachel-Touchfläche unabhängig von Grafikgröße halten – auf 320–359 px Smartphone-Breite.
177. Kachel-Touchfläche unabhängig von Grafikgröße halten – auf 360–429 px Smartphone-Breite.
178. Kachel-Touchfläche unabhängig von Grafikgröße halten – auf großen Smartphones ab 430 px.
179. Kachel-Touchfläche unabhängig von Grafikgröße halten – auf Tablets im Hochformat.
180. Kachel-Touchfläche unabhängig von Grafikgröße halten – auf Tablets und Desktop im Querformat.
181. Schatten auf OLED-Displays kontrollieren – auf 320–359 px Smartphone-Breite.
182. Schatten auf OLED-Displays kontrollieren – auf 360–429 px Smartphone-Breite.
183. Schatten auf OLED-Displays kontrollieren – auf großen Smartphones ab 430 px.
184. Schatten auf OLED-Displays kontrollieren – auf Tablets im Hochformat.
185. Schatten auf OLED-Displays kontrollieren – auf Tablets und Desktop im Querformat.
186. Badges von wichtigen Motiven fernhalten – auf 320–359 px Smartphone-Breite.
187. Badges von wichtigen Motiven fernhalten – auf 360–429 px Smartphone-Breite.
188. Badges von wichtigen Motiven fernhalten – auf großen Smartphones ab 430 px.
189. Badges von wichtigen Motiven fernhalten – auf Tablets im Hochformat.
190. Badges von wichtigen Motiven fernhalten – auf Tablets und Desktop im Querformat.
191. Kleine App-Labels lesbar halten – auf 320–359 px Smartphone-Breite.
192. Kleine App-Labels lesbar halten – auf 360–429 px Smartphone-Breite.
193. Kleine App-Labels lesbar halten – auf großen Smartphones ab 430 px.
194. Kleine App-Labels lesbar halten – auf Tablets im Hochformat.
195. Kleine App-Labels lesbar halten – auf Tablets und Desktop im Querformat.
196. App-Kacheln im Fokus klar umranden – auf 320–359 px Smartphone-Breite.
197. App-Kacheln im Fokus klar umranden – auf 360–429 px Smartphone-Breite.
198. App-Kacheln im Fokus klar umranden – auf großen Smartphones ab 430 px.
199. App-Kacheln im Fokus klar umranden – auf Tablets im Hochformat.
200. App-Kacheln im Fokus klar umranden – auf Tablets und Desktop im Querformat.

## Raster und Seiten

201. Spaltenzahl anhand verfügbarer Breite wählen – auf 320–359 px Smartphone-Breite.
202. Spaltenzahl anhand verfügbarer Breite wählen – auf 360–429 px Smartphone-Breite.
203. Spaltenzahl anhand verfügbarer Breite wählen – auf großen Smartphones ab 430 px.
204. Spaltenzahl anhand verfügbarer Breite wählen – auf Tablets im Hochformat.
205. Spaltenzahl anhand verfügbarer Breite wählen – auf Tablets und Desktop im Querformat.
206. Rasterlücken bei großen Kacheln verhindern – auf 320–359 px Smartphone-Breite.
207. Rasterlücken bei großen Kacheln verhindern – auf 360–429 px Smartphone-Breite.
208. Rasterlücken bei großen Kacheln verhindern – auf großen Smartphones ab 430 px.
209. Rasterlücken bei großen Kacheln verhindern – auf Tablets im Hochformat.
210. Rasterlücken bei großen Kacheln verhindern – auf Tablets und Desktop im Querformat.
211. Letzte unvollständige Seite sauber ausrichten – auf 320–359 px Smartphone-Breite.
212. Letzte unvollständige Seite sauber ausrichten – auf 360–429 px Smartphone-Breite.
213. Letzte unvollständige Seite sauber ausrichten – auf großen Smartphones ab 430 px.
214. Letzte unvollständige Seite sauber ausrichten – auf Tablets im Hochformat.
215. Letzte unvollständige Seite sauber ausrichten – auf Tablets und Desktop im Querformat.
216. Seitenindikatoren bei vielen Seiten scrollbar halten – auf 320–359 px Smartphone-Breite.
217. Seitenindikatoren bei vielen Seiten scrollbar halten – auf 360–429 px Smartphone-Breite.
218. Seitenindikatoren bei vielen Seiten scrollbar halten – auf großen Smartphones ab 430 px.
219. Seitenindikatoren bei vielen Seiten scrollbar halten – auf Tablets im Hochformat.
220. Seitenindikatoren bei vielen Seiten scrollbar halten – auf Tablets und Desktop im Querformat.
221. Aktive Seite zusätzlich semantisch markieren – auf 320–359 px Smartphone-Breite.
222. Aktive Seite zusätzlich semantisch markieren – auf 360–429 px Smartphone-Breite.
223. Aktive Seite zusätzlich semantisch markieren – auf großen Smartphones ab 430 px.
224. Aktive Seite zusätzlich semantisch markieren – auf Tablets im Hochformat.
225. Aktive Seite zusätzlich semantisch markieren – auf Tablets und Desktop im Querformat.
226. Querformat-Raster verdichten – auf 320–359 px Smartphone-Breite.
227. Querformat-Raster verdichten – auf 360–429 px Smartphone-Breite.
228. Querformat-Raster verdichten – auf großen Smartphones ab 430 px.
229. Querformat-Raster verdichten – auf Tablets im Hochformat.
230. Querformat-Raster verdichten – auf Tablets und Desktop im Querformat.
231. Tablet-Raster ohne übergroße Icons darstellen – auf 320–359 px Smartphone-Breite.
232. Tablet-Raster ohne übergroße Icons darstellen – auf 360–429 px Smartphone-Breite.
233. Tablet-Raster ohne übergroße Icons darstellen – auf großen Smartphones ab 430 px.
234. Tablet-Raster ohne übergroße Icons darstellen – auf Tablets im Hochformat.
235. Tablet-Raster ohne übergroße Icons darstellen – auf Tablets und Desktop im Querformat.
236. Zoom bis 200 Prozent ohne Überlauf testen – auf 320–359 px Smartphone-Breite.
237. Zoom bis 200 Prozent ohne Überlauf testen – auf 360–429 px Smartphone-Breite.
238. Zoom bis 200 Prozent ohne Überlauf testen – auf großen Smartphones ab 430 px.
239. Zoom bis 200 Prozent ohne Überlauf testen – auf Tablets im Hochformat.
240. Zoom bis 200 Prozent ohne Überlauf testen – auf Tablets und Desktop im Querformat.
241. Drag-Reihenfolge visuell nachvollziehbar halten – auf 320–359 px Smartphone-Breite.
242. Drag-Reihenfolge visuell nachvollziehbar halten – auf 360–429 px Smartphone-Breite.
243. Drag-Reihenfolge visuell nachvollziehbar halten – auf großen Smartphones ab 430 px.
244. Drag-Reihenfolge visuell nachvollziehbar halten – auf Tablets im Hochformat.
245. Drag-Reihenfolge visuell nachvollziehbar halten – auf Tablets und Desktop im Querformat.
246. Gruppengrenzen beim Seitenwechsel erhalten – auf 320–359 px Smartphone-Breite.
247. Gruppengrenzen beim Seitenwechsel erhalten – auf 360–429 px Smartphone-Breite.
248. Gruppengrenzen beim Seitenwechsel erhalten – auf großen Smartphones ab 430 px.
249. Gruppengrenzen beim Seitenwechsel erhalten – auf Tablets im Hochformat.
250. Gruppengrenzen beim Seitenwechsel erhalten – auf Tablets und Desktop im Querformat.

## Widgets

251. Widget-Inhalte ohne Layoutsprünge laden – auf 320–359 px Smartphone-Breite.
252. Widget-Inhalte ohne Layoutsprünge laden – auf 360–429 px Smartphone-Breite.
253. Widget-Inhalte ohne Layoutsprünge laden – auf großen Smartphones ab 430 px.
254. Widget-Inhalte ohne Layoutsprünge laden – auf Tablets im Hochformat.
255. Widget-Inhalte ohne Layoutsprünge laden – auf Tablets und Desktop im Querformat.
256. Lange Inhalte begrenzen und vollständig erreichbar machen – auf 320–359 px Smartphone-Breite.
257. Lange Inhalte begrenzen und vollständig erreichbar machen – auf 360–429 px Smartphone-Breite.
258. Lange Inhalte begrenzen und vollständig erreichbar machen – auf großen Smartphones ab 430 px.
259. Lange Inhalte begrenzen und vollständig erreichbar machen – auf Tablets im Hochformat.
260. Lange Inhalte begrenzen und vollständig erreichbar machen – auf Tablets und Desktop im Querformat.
261. Widget-Aktionen mit Mindesthöhe ausstatten – auf 320–359 px Smartphone-Breite.
262. Widget-Aktionen mit Mindesthöhe ausstatten – auf 360–429 px Smartphone-Breite.
263. Widget-Aktionen mit Mindesthöhe ausstatten – auf großen Smartphones ab 430 px.
264. Widget-Aktionen mit Mindesthöhe ausstatten – auf Tablets im Hochformat.
265. Widget-Aktionen mit Mindesthöhe ausstatten – auf Tablets und Desktop im Querformat.
266. Fokus innerhalb von Widgets sichtbar machen – auf 320–359 px Smartphone-Breite.
267. Fokus innerhalb von Widgets sichtbar machen – auf 360–429 px Smartphone-Breite.
268. Fokus innerhalb von Widgets sichtbar machen – auf großen Smartphones ab 430 px.
269. Fokus innerhalb von Widgets sichtbar machen – auf Tablets im Hochformat.
270. Fokus innerhalb von Widgets sichtbar machen – auf Tablets und Desktop im Querformat.
271. Widget-Karten auf Touch nicht hover-abhängig gestalten – auf 320–359 px Smartphone-Breite.
272. Widget-Karten auf Touch nicht hover-abhängig gestalten – auf 360–429 px Smartphone-Breite.
273. Widget-Karten auf Touch nicht hover-abhängig gestalten – auf großen Smartphones ab 430 px.
274. Widget-Karten auf Touch nicht hover-abhängig gestalten – auf Tablets im Hochformat.
275. Widget-Karten auf Touch nicht hover-abhängig gestalten – auf Tablets und Desktop im Querformat.
276. Leere Widget-Zustände verständlich beschriften – auf 320–359 px Smartphone-Breite.
277. Leere Widget-Zustände verständlich beschriften – auf 360–429 px Smartphone-Breite.
278. Leere Widget-Zustände verständlich beschriften – auf großen Smartphones ab 430 px.
279. Leere Widget-Zustände verständlich beschriften – auf Tablets im Hochformat.
280. Leere Widget-Zustände verständlich beschriften – auf Tablets und Desktop im Querformat.
281. Fehlerzustände pro Widget isolieren – auf 320–359 px Smartphone-Breite.
282. Fehlerzustände pro Widget isolieren – auf 360–429 px Smartphone-Breite.
283. Fehlerzustände pro Widget isolieren – auf großen Smartphones ab 430 px.
284. Fehlerzustände pro Widget isolieren – auf Tablets im Hochformat.
285. Fehlerzustände pro Widget isolieren – auf Tablets und Desktop im Querformat.
286. Widget-Größen auf kleinen Displays abstimmen – auf 320–359 px Smartphone-Breite.
287. Widget-Größen auf kleinen Displays abstimmen – auf 360–429 px Smartphone-Breite.
288. Widget-Größen auf kleinen Displays abstimmen – auf großen Smartphones ab 430 px.
289. Widget-Größen auf kleinen Displays abstimmen – auf Tablets im Hochformat.
290. Widget-Größen auf kleinen Displays abstimmen – auf Tablets und Desktop im Querformat.
291. Widget-Links mit klarer visueller Hierarchie versehen – auf 320–359 px Smartphone-Breite.
292. Widget-Links mit klarer visueller Hierarchie versehen – auf 360–429 px Smartphone-Breite.
293. Widget-Links mit klarer visueller Hierarchie versehen – auf großen Smartphones ab 430 px.
294. Widget-Links mit klarer visueller Hierarchie versehen – auf Tablets im Hochformat.
295. Widget-Links mit klarer visueller Hierarchie versehen – auf Tablets und Desktop im Querformat.
296. Widget-Kontrast auf allen Wallpapers prüfen – auf 320–359 px Smartphone-Breite.
297. Widget-Kontrast auf allen Wallpapers prüfen – auf 360–429 px Smartphone-Breite.
298. Widget-Kontrast auf allen Wallpapers prüfen – auf großen Smartphones ab 430 px.
299. Widget-Kontrast auf allen Wallpapers prüfen – auf Tablets im Hochformat.
300. Widget-Kontrast auf allen Wallpapers prüfen – auf Tablets und Desktop im Querformat.

## Header und Navigation

301. Header-Buttons auf gleiche Größe bringen – auf 320–359 px Smartphone-Breite.
302. Header-Buttons auf gleiche Größe bringen – auf 360–429 px Smartphone-Breite.
303. Header-Buttons auf gleiche Größe bringen – auf großen Smartphones ab 430 px.
304. Header-Buttons auf gleiche Größe bringen – auf Tablets im Hochformat.
305. Header-Buttons auf gleiche Größe bringen – auf Tablets und Desktop im Querformat.
306. Touchziele auf schmalen Geräten vor Überlauf schützen – auf 320–359 px Smartphone-Breite.
307. Touchziele auf schmalen Geräten vor Überlauf schützen – auf 360–429 px Smartphone-Breite.
308. Touchziele auf schmalen Geräten vor Überlauf schützen – auf großen Smartphones ab 430 px.
309. Touchziele auf schmalen Geräten vor Überlauf schützen – auf Tablets im Hochformat.
310. Touchziele auf schmalen Geräten vor Überlauf schützen – auf Tablets und Desktop im Querformat.
311. Avatar-Fallback bei fehlendem Bild gestalten – auf 320–359 px Smartphone-Breite.
312. Avatar-Fallback bei fehlendem Bild gestalten – auf 360–429 px Smartphone-Breite.
313. Avatar-Fallback bei fehlendem Bild gestalten – auf großen Smartphones ab 430 px.
314. Avatar-Fallback bei fehlendem Bild gestalten – auf Tablets im Hochformat.
315. Avatar-Fallback bei fehlendem Bild gestalten – auf Tablets und Desktop im Querformat.
316. Badges nicht mit Header-Aktionen überlagern – auf 320–359 px Smartphone-Breite.
317. Badges nicht mit Header-Aktionen überlagern – auf 360–429 px Smartphone-Breite.
318. Badges nicht mit Header-Aktionen überlagern – auf großen Smartphones ab 430 px.
319. Badges nicht mit Header-Aktionen überlagern – auf Tablets im Hochformat.
320. Badges nicht mit Header-Aktionen überlagern – auf Tablets und Desktop im Querformat.
321. Suchaktion mit verständlichem Accessible Name versehen – auf 320–359 px Smartphone-Breite.
322. Suchaktion mit verständlichem Accessible Name versehen – auf 360–429 px Smartphone-Breite.
323. Suchaktion mit verständlichem Accessible Name versehen – auf großen Smartphones ab 430 px.
324. Suchaktion mit verständlichem Accessible Name versehen – auf Tablets im Hochformat.
325. Suchaktion mit verständlichem Accessible Name versehen – auf Tablets und Desktop im Querformat.
326. Fokusreihenfolge im Header logisch halten – auf 320–359 px Smartphone-Breite.
327. Fokusreihenfolge im Header logisch halten – auf 360–429 px Smartphone-Breite.
328. Fokusreihenfolge im Header logisch halten – auf großen Smartphones ab 430 px.
329. Fokusreihenfolge im Header logisch halten – auf Tablets im Hochformat.
330. Fokusreihenfolge im Header logisch halten – auf Tablets und Desktop im Querformat.
331. Home-Bar-Abstand auf kurzen Viewports prüfen – auf 320–359 px Smartphone-Breite.
332. Home-Bar-Abstand auf kurzen Viewports prüfen – auf 360–429 px Smartphone-Breite.
333. Home-Bar-Abstand auf kurzen Viewports prüfen – auf großen Smartphones ab 430 px.
334. Home-Bar-Abstand auf kurzen Viewports prüfen – auf Tablets im Hochformat.
335. Home-Bar-Abstand auf kurzen Viewports prüfen – auf Tablets und Desktop im Querformat.
336. Doppelte Navigationsaktionen vermeiden – auf 320–359 px Smartphone-Breite.
337. Doppelte Navigationsaktionen vermeiden – auf 360–429 px Smartphone-Breite.
338. Doppelte Navigationsaktionen vermeiden – auf großen Smartphones ab 430 px.
339. Doppelte Navigationsaktionen vermeiden – auf Tablets im Hochformat.
340. Doppelte Navigationsaktionen vermeiden – auf Tablets und Desktop im Querformat.
341. Landscape-Header neu verteilen – auf 320–359 px Smartphone-Breite.
342. Landscape-Header neu verteilen – auf 360–429 px Smartphone-Breite.
343. Landscape-Header neu verteilen – auf großen Smartphones ab 430 px.
344. Landscape-Header neu verteilen – auf Tablets im Hochformat.
345. Landscape-Header neu verteilen – auf Tablets und Desktop im Querformat.
346. Header bei hoher Textskalierung testen – auf 320–359 px Smartphone-Breite.
347. Header bei hoher Textskalierung testen – auf 360–429 px Smartphone-Breite.
348. Header bei hoher Textskalierung testen – auf großen Smartphones ab 430 px.
349. Header bei hoher Textskalierung testen – auf Tablets im Hochformat.
350. Header bei hoher Textskalierung testen – auf Tablets und Desktop im Querformat.

## Bearbeitungsmodus

351. Edit-Modus dauerhaft erkennbar machen – auf 320–359 px Smartphone-Breite.
352. Edit-Modus dauerhaft erkennbar machen – auf 360–429 px Smartphone-Breite.
353. Edit-Modus dauerhaft erkennbar machen – auf großen Smartphones ab 430 px.
354. Edit-Modus dauerhaft erkennbar machen – auf Tablets im Hochformat.
355. Edit-Modus dauerhaft erkennbar machen – auf Tablets und Desktop im Querformat.
356. Drag-Quelle und Drop-Ziel unterscheiden – auf 320–359 px Smartphone-Breite.
357. Drag-Quelle und Drop-Ziel unterscheiden – auf 360–429 px Smartphone-Breite.
358. Drag-Quelle und Drop-Ziel unterscheiden – auf großen Smartphones ab 430 px.
359. Drag-Quelle und Drop-Ziel unterscheiden – auf Tablets im Hochformat.
360. Drag-Quelle und Drop-Ziel unterscheiden – auf Tablets und Desktop im Querformat.
361. Drop-Ziel nicht ausschließlich farblich markieren – auf 320–359 px Smartphone-Breite.
362. Drop-Ziel nicht ausschließlich farblich markieren – auf 360–429 px Smartphone-Breite.
363. Drop-Ziel nicht ausschließlich farblich markieren – auf großen Smartphones ab 430 px.
364. Drop-Ziel nicht ausschließlich farblich markieren – auf Tablets im Hochformat.
365. Drop-Ziel nicht ausschließlich farblich markieren – auf Tablets und Desktop im Querformat.
366. Abbrechen-Aktion erreichbar halten – auf 320–359 px Smartphone-Breite.
367. Abbrechen-Aktion erreichbar halten – auf 360–429 px Smartphone-Breite.
368. Abbrechen-Aktion erreichbar halten – auf großen Smartphones ab 430 px.
369. Abbrechen-Aktion erreichbar halten – auf Tablets im Hochformat.
370. Abbrechen-Aktion erreichbar halten – auf Tablets und Desktop im Querformat.
371. Änderungsfeedback ohne Layoutsprung anzeigen – auf 320–359 px Smartphone-Breite.
372. Änderungsfeedback ohne Layoutsprung anzeigen – auf 360–429 px Smartphone-Breite.
373. Änderungsfeedback ohne Layoutsprung anzeigen – auf großen Smartphones ab 430 px.
374. Änderungsfeedback ohne Layoutsprung anzeigen – auf Tablets im Hochformat.
375. Änderungsfeedback ohne Layoutsprung anzeigen – auf Tablets und Desktop im Querformat.
376. Lange Einstellungen in klare Gruppen teilen – auf 320–359 px Smartphone-Breite.
377. Lange Einstellungen in klare Gruppen teilen – auf 360–429 px Smartphone-Breite.
378. Lange Einstellungen in klare Gruppen teilen – auf großen Smartphones ab 430 px.
379. Lange Einstellungen in klare Gruppen teilen – auf Tablets im Hochformat.
380. Lange Einstellungen in klare Gruppen teilen – auf Tablets und Desktop im Querformat.
381. Fehlermeldungen direkt am Feld anzeigen – auf 320–359 px Smartphone-Breite.
382. Fehlermeldungen direkt am Feld anzeigen – auf 360–429 px Smartphone-Breite.
383. Fehlermeldungen direkt am Feld anzeigen – auf großen Smartphones ab 430 px.
384. Fehlermeldungen direkt am Feld anzeigen – auf Tablets im Hochformat.
385. Fehlermeldungen direkt am Feld anzeigen – auf Tablets und Desktop im Querformat.
386. Ausgewählte Wallpaper-Vorschau hervorheben – auf 320–359 px Smartphone-Breite.
387. Ausgewählte Wallpaper-Vorschau hervorheben – auf 360–429 px Smartphone-Breite.
388. Ausgewählte Wallpaper-Vorschau hervorheben – auf großen Smartphones ab 430 px.
389. Ausgewählte Wallpaper-Vorschau hervorheben – auf Tablets im Hochformat.
390. Ausgewählte Wallpaper-Vorschau hervorheben – auf Tablets und Desktop im Querformat.
391. Upload-Status verständlich darstellen – auf 320–359 px Smartphone-Breite.
392. Upload-Status verständlich darstellen – auf 360–429 px Smartphone-Breite.
393. Upload-Status verständlich darstellen – auf großen Smartphones ab 430 px.
394. Upload-Status verständlich darstellen – auf Tablets im Hochformat.
395. Upload-Status verständlich darstellen – auf Tablets und Desktop im Querformat.
396. Bearbeitung per Tastatur ermöglichen – auf 320–359 px Smartphone-Breite.
397. Bearbeitung per Tastatur ermöglichen – auf 360–429 px Smartphone-Breite.
398. Bearbeitung per Tastatur ermöglichen – auf großen Smartphones ab 430 px.
399. Bearbeitung per Tastatur ermöglichen – auf Tablets im Hochformat.
400. Bearbeitung per Tastatur ermöglichen – auf Tablets und Desktop im Querformat.

## Touch und Gesten

401. Long-Press und Scroll-Geste konfliktfrei halten – auf 320–359 px Smartphone-Breite.
402. Long-Press und Scroll-Geste konfliktfrei halten – auf 360–429 px Smartphone-Breite.
403. Long-Press und Scroll-Geste konfliktfrei halten – auf großen Smartphones ab 430 px.
404. Long-Press und Scroll-Geste konfliktfrei halten – auf Tablets im Hochformat.
405. Long-Press und Scroll-Geste konfliktfrei halten – auf Tablets und Desktop im Querformat.
406. Swipe-Schwellen auf kleinen Displays prüfen – auf 320–359 px Smartphone-Breite.
407. Swipe-Schwellen auf kleinen Displays prüfen – auf 360–429 px Smartphone-Breite.
408. Swipe-Schwellen auf kleinen Displays prüfen – auf großen Smartphones ab 430 px.
409. Swipe-Schwellen auf kleinen Displays prüfen – auf Tablets im Hochformat.
410. Swipe-Schwellen auf kleinen Displays prüfen – auf Tablets und Desktop im Querformat.
411. Pointer-Cancel zuverlässig behandeln – auf 320–359 px Smartphone-Breite.
412. Pointer-Cancel zuverlässig behandeln – auf 360–429 px Smartphone-Breite.
413. Pointer-Cancel zuverlässig behandeln – auf großen Smartphones ab 430 px.
414. Pointer-Cancel zuverlässig behandeln – auf Tablets im Hochformat.
415. Pointer-Cancel zuverlässig behandeln – auf Tablets und Desktop im Querformat.
416. Drag-Vorschau nicht unter dem Finger verstecken – auf 320–359 px Smartphone-Breite.
417. Drag-Vorschau nicht unter dem Finger verstecken – auf 360–429 px Smartphone-Breite.
418. Drag-Vorschau nicht unter dem Finger verstecken – auf großen Smartphones ab 430 px.
419. Drag-Vorschau nicht unter dem Finger verstecken – auf Tablets im Hochformat.
420. Drag-Vorschau nicht unter dem Finger verstecken – auf Tablets und Desktop im Querformat.
421. Touchziele ausreichend voneinander trennen – auf 320–359 px Smartphone-Breite.
422. Touchziele ausreichend voneinander trennen – auf 360–429 px Smartphone-Breite.
423. Touchziele ausreichend voneinander trennen – auf großen Smartphones ab 430 px.
424. Touchziele ausreichend voneinander trennen – auf Tablets im Hochformat.
425. Touchziele ausreichend voneinander trennen – auf Tablets und Desktop im Querformat.
426. Klick nach Long-Press unterdrücken – auf 320–359 px Smartphone-Breite.
427. Klick nach Long-Press unterdrücken – auf 360–429 px Smartphone-Breite.
428. Klick nach Long-Press unterdrücken – auf großen Smartphones ab 430 px.
429. Klick nach Long-Press unterdrücken – auf Tablets im Hochformat.
430. Klick nach Long-Press unterdrücken – auf Tablets und Desktop im Querformat.
431. Vertikales Scrollen jederzeit ermöglichen – auf 320–359 px Smartphone-Breite.
432. Vertikales Scrollen jederzeit ermöglichen – auf 360–429 px Smartphone-Breite.
433. Vertikales Scrollen jederzeit ermöglichen – auf großen Smartphones ab 430 px.
434. Vertikales Scrollen jederzeit ermöglichen – auf Tablets im Hochformat.
435. Vertikales Scrollen jederzeit ermöglichen – auf Tablets und Desktop im Querformat.
436. Touchfeedback ohne Verzögerung geben – auf 320–359 px Smartphone-Breite.
437. Touchfeedback ohne Verzögerung geben – auf 360–429 px Smartphone-Breite.
438. Touchfeedback ohne Verzögerung geben – auf großen Smartphones ab 430 px.
439. Touchfeedback ohne Verzögerung geben – auf Tablets im Hochformat.
440. Touchfeedback ohne Verzögerung geben – auf Tablets und Desktop im Querformat.
441. Stiftbedienung nicht blockieren – auf 320–359 px Smartphone-Breite.
442. Stiftbedienung nicht blockieren – auf 360–429 px Smartphone-Breite.
443. Stiftbedienung nicht blockieren – auf großen Smartphones ab 430 px.
444. Stiftbedienung nicht blockieren – auf Tablets im Hochformat.
445. Stiftbedienung nicht blockieren – auf Tablets und Desktop im Querformat.
446. Gesten durch sichtbare Alternativen ergänzen – auf 320–359 px Smartphone-Breite.
447. Gesten durch sichtbare Alternativen ergänzen – auf 360–429 px Smartphone-Breite.
448. Gesten durch sichtbare Alternativen ergänzen – auf großen Smartphones ab 430 px.
449. Gesten durch sichtbare Alternativen ergänzen – auf Tablets im Hochformat.
450. Gesten durch sichtbare Alternativen ergänzen – auf Tablets und Desktop im Querformat.

## Tastaturbedienung

451. Alle Launcher-Aktionen mit Tab erreichbar machen – auf 320–359 px Smartphone-Breite.
452. Alle Launcher-Aktionen mit Tab erreichbar machen – auf 360–429 px Smartphone-Breite.
453. Alle Launcher-Aktionen mit Tab erreichbar machen – auf großen Smartphones ab 430 px.
454. Alle Launcher-Aktionen mit Tab erreichbar machen – auf Tablets im Hochformat.
455. Alle Launcher-Aktionen mit Tab erreichbar machen – auf Tablets und Desktop im Querformat.
456. Enter und Leertaste konsistent behandeln – auf 320–359 px Smartphone-Breite.
457. Enter und Leertaste konsistent behandeln – auf 360–429 px Smartphone-Breite.
458. Enter und Leertaste konsistent behandeln – auf großen Smartphones ab 430 px.
459. Enter und Leertaste konsistent behandeln – auf Tablets im Hochformat.
460. Enter und Leertaste konsistent behandeln – auf Tablets und Desktop im Querformat.
461. Fokus nach Dialogschließen zurückgeben – auf 320–359 px Smartphone-Breite.
462. Fokus nach Dialogschließen zurückgeben – auf 360–429 px Smartphone-Breite.
463. Fokus nach Dialogschließen zurückgeben – auf großen Smartphones ab 430 px.
464. Fokus nach Dialogschließen zurückgeben – auf Tablets im Hochformat.
465. Fokus nach Dialogschließen zurückgeben – auf Tablets und Desktop im Querformat.
466. Escape schließt nur den obersten Dialog – auf 320–359 px Smartphone-Breite.
467. Escape schließt nur den obersten Dialog – auf 360–429 px Smartphone-Breite.
468. Escape schließt nur den obersten Dialog – auf großen Smartphones ab 430 px.
469. Escape schließt nur den obersten Dialog – auf Tablets im Hochformat.
470. Escape schließt nur den obersten Dialog – auf Tablets und Desktop im Querformat.
471. Fokusreihenfolge folgt der visuellen Reihenfolge – auf 320–359 px Smartphone-Breite.
472. Fokusreihenfolge folgt der visuellen Reihenfolge – auf 360–429 px Smartphone-Breite.
473. Fokusreihenfolge folgt der visuellen Reihenfolge – auf großen Smartphones ab 430 px.
474. Fokusreihenfolge folgt der visuellen Reihenfolge – auf Tablets im Hochformat.
475. Fokusreihenfolge folgt der visuellen Reihenfolge – auf Tablets und Desktop im Querformat.
476. Fokus bei Seitenwechsel auf sinnvoller Position halten – auf 320–359 px Smartphone-Breite.
477. Fokus bei Seitenwechsel auf sinnvoller Position halten – auf 360–429 px Smartphone-Breite.
478. Fokus bei Seitenwechsel auf sinnvoller Position halten – auf großen Smartphones ab 430 px.
479. Fokus bei Seitenwechsel auf sinnvoller Position halten – auf Tablets im Hochformat.
480. Fokus bei Seitenwechsel auf sinnvoller Position halten – auf Tablets und Desktop im Querformat.
481. Drag-and-drop per Tastatur ergänzen – auf 320–359 px Smartphone-Breite.
482. Drag-and-drop per Tastatur ergänzen – auf 360–429 px Smartphone-Breite.
483. Drag-and-drop per Tastatur ergänzen – auf großen Smartphones ab 430 px.
484. Drag-and-drop per Tastatur ergänzen – auf Tablets im Hochformat.
485. Drag-and-drop per Tastatur ergänzen – auf Tablets und Desktop im Querformat.
486. Shortcut-Hinweise nicht nur visuell anzeigen – auf 320–359 px Smartphone-Breite.
487. Shortcut-Hinweise nicht nur visuell anzeigen – auf 360–429 px Smartphone-Breite.
488. Shortcut-Hinweise nicht nur visuell anzeigen – auf großen Smartphones ab 430 px.
489. Shortcut-Hinweise nicht nur visuell anzeigen – auf Tablets im Hochformat.
490. Shortcut-Hinweise nicht nur visuell anzeigen – auf Tablets und Desktop im Querformat.
491. Keine Tastaturfalle im Edit-Modus erzeugen – auf 320–359 px Smartphone-Breite.
492. Keine Tastaturfalle im Edit-Modus erzeugen – auf 360–429 px Smartphone-Breite.
493. Keine Tastaturfalle im Edit-Modus erzeugen – auf großen Smartphones ab 430 px.
494. Keine Tastaturfalle im Edit-Modus erzeugen – auf Tablets im Hochformat.
495. Keine Tastaturfalle im Edit-Modus erzeugen – auf Tablets und Desktop im Querformat.
496. Fokus bei dynamischen App-Listen erhalten – auf 320–359 px Smartphone-Breite.
497. Fokus bei dynamischen App-Listen erhalten – auf 360–429 px Smartphone-Breite.
498. Fokus bei dynamischen App-Listen erhalten – auf großen Smartphones ab 430 px.
499. Fokus bei dynamischen App-Listen erhalten – auf Tablets im Hochformat.
500. Fokus bei dynamischen App-Listen erhalten – auf Tablets und Desktop im Querformat.

## Barrierefreiheit

501. Accessible Names für Icon-Buttons prüfen – auf 320–359 px Smartphone-Breite.
502. Accessible Names für Icon-Buttons prüfen – auf 360–429 px Smartphone-Breite.
503. Accessible Names für Icon-Buttons prüfen – auf großen Smartphones ab 430 px.
504. Accessible Names für Icon-Buttons prüfen – auf Tablets im Hochformat.
505. Accessible Names für Icon-Buttons prüfen – auf Tablets und Desktop im Querformat.
506. ARIA-expanded für Gruppen korrekt setzen – auf 320–359 px Smartphone-Breite.
507. ARIA-expanded für Gruppen korrekt setzen – auf 360–429 px Smartphone-Breite.
508. ARIA-expanded für Gruppen korrekt setzen – auf großen Smartphones ab 430 px.
509. ARIA-expanded für Gruppen korrekt setzen – auf Tablets im Hochformat.
510. ARIA-expanded für Gruppen korrekt setzen – auf Tablets und Desktop im Querformat.
511. ARIA-current für Seitenindikatoren setzen – auf 320–359 px Smartphone-Breite.
512. ARIA-current für Seitenindikatoren setzen – auf 360–429 px Smartphone-Breite.
513. ARIA-current für Seitenindikatoren setzen – auf großen Smartphones ab 430 px.
514. ARIA-current für Seitenindikatoren setzen – auf Tablets im Hochformat.
515. ARIA-current für Seitenindikatoren setzen – auf Tablets und Desktop im Querformat.
516. Statusänderungen mit Live-Region melden – auf 320–359 px Smartphone-Breite.
517. Statusänderungen mit Live-Region melden – auf 360–429 px Smartphone-Breite.
518. Statusänderungen mit Live-Region melden – auf großen Smartphones ab 430 px.
519. Statusänderungen mit Live-Region melden – auf Tablets im Hochformat.
520. Statusänderungen mit Live-Region melden – auf Tablets und Desktop im Querformat.
521. Fehler mit passender Semantik ausgeben – auf 320–359 px Smartphone-Breite.
522. Fehler mit passender Semantik ausgeben – auf 360–429 px Smartphone-Breite.
523. Fehler mit passender Semantik ausgeben – auf großen Smartphones ab 430 px.
524. Fehler mit passender Semantik ausgeben – auf Tablets im Hochformat.
525. Fehler mit passender Semantik ausgeben – auf Tablets und Desktop im Querformat.
526. Kontrast im Forced-Colors-Modus testen – auf 320–359 px Smartphone-Breite.
527. Kontrast im Forced-Colors-Modus testen – auf 360–429 px Smartphone-Breite.
528. Kontrast im Forced-Colors-Modus testen – auf großen Smartphones ab 430 px.
529. Kontrast im Forced-Colors-Modus testen – auf Tablets im Hochformat.
530. Kontrast im Forced-Colors-Modus testen – auf Tablets und Desktop im Querformat.
531. Reduced Motion global respektieren – auf 320–359 px Smartphone-Breite.
532. Reduced Motion global respektieren – auf 360–429 px Smartphone-Breite.
533. Reduced Motion global respektieren – auf großen Smartphones ab 430 px.
534. Reduced Motion global respektieren – auf Tablets im Hochformat.
535. Reduced Motion global respektieren – auf Tablets und Desktop im Querformat.
536. Reduced Transparency berücksichtigen – auf 320–359 px Smartphone-Breite.
537. Reduced Transparency berücksichtigen – auf 360–429 px Smartphone-Breite.
538. Reduced Transparency berücksichtigen – auf großen Smartphones ab 430 px.
539. Reduced Transparency berücksichtigen – auf Tablets im Hochformat.
540. Reduced Transparency berücksichtigen – auf Tablets und Desktop im Querformat.
541. Screenreader-Reihenfolge der App-Gruppen prüfen – auf 320–359 px Smartphone-Breite.
542. Screenreader-Reihenfolge der App-Gruppen prüfen – auf 360–429 px Smartphone-Breite.
543. Screenreader-Reihenfolge der App-Gruppen prüfen – auf großen Smartphones ab 430 px.
544. Screenreader-Reihenfolge der App-Gruppen prüfen – auf Tablets im Hochformat.
545. Screenreader-Reihenfolge der App-Gruppen prüfen – auf Tablets und Desktop im Querformat.
546. Textvergrößerung ohne Abschneiden unterstützen – auf 320–359 px Smartphone-Breite.
547. Textvergrößerung ohne Abschneiden unterstützen – auf 360–429 px Smartphone-Breite.
548. Textvergrößerung ohne Abschneiden unterstützen – auf großen Smartphones ab 430 px.
549. Textvergrößerung ohne Abschneiden unterstützen – auf Tablets im Hochformat.
550. Textvergrößerung ohne Abschneiden unterstützen – auf Tablets und Desktop im Querformat.

## Responsive Geräte

551. 320-Pixel-Breite ohne horizontales Scrollen darstellen – auf 320–359 px Smartphone-Breite.
552. 320-Pixel-Breite ohne horizontales Scrollen darstellen – auf 360–429 px Smartphone-Breite.
553. 320-Pixel-Breite ohne horizontales Scrollen darstellen – auf großen Smartphones ab 430 px.
554. 320-Pixel-Breite ohne horizontales Scrollen darstellen – auf Tablets im Hochformat.
555. 320-Pixel-Breite ohne horizontales Scrollen darstellen – auf Tablets und Desktop im Querformat.
556. 360-Pixel-Breite auf Android testen – auf 320–359 px Smartphone-Breite.
557. 360-Pixel-Breite auf Android testen – auf 360–429 px Smartphone-Breite.
558. 360-Pixel-Breite auf Android testen – auf großen Smartphones ab 430 px.
559. 360-Pixel-Breite auf Android testen – auf Tablets im Hochformat.
560. 360-Pixel-Breite auf Android testen – auf Tablets und Desktop im Querformat.
561. Große Smartphones mit passender Spaltenzahl darstellen – auf 320–359 px Smartphone-Breite.
562. Große Smartphones mit passender Spaltenzahl darstellen – auf 360–429 px Smartphone-Breite.
563. Große Smartphones mit passender Spaltenzahl darstellen – auf großen Smartphones ab 430 px.
564. Große Smartphones mit passender Spaltenzahl darstellen – auf Tablets im Hochformat.
565. Große Smartphones mit passender Spaltenzahl darstellen – auf Tablets und Desktop im Querformat.
566. Tablet-Split-Screen berücksichtigen – auf 320–359 px Smartphone-Breite.
567. Tablet-Split-Screen berücksichtigen – auf 360–429 px Smartphone-Breite.
568. Tablet-Split-Screen berücksichtigen – auf großen Smartphones ab 430 px.
569. Tablet-Split-Screen berücksichtigen – auf Tablets im Hochformat.
570. Tablet-Split-Screen berücksichtigen – auf Tablets und Desktop im Querformat.
571. iPad Hochformat und Querformat abstimmen – auf 320–359 px Smartphone-Breite.
572. iPad Hochformat und Querformat abstimmen – auf 360–429 px Smartphone-Breite.
573. iPad Hochformat und Querformat abstimmen – auf großen Smartphones ab 430 px.
574. iPad Hochformat und Querformat abstimmen – auf Tablets im Hochformat.
575. iPad Hochformat und Querformat abstimmen – auf Tablets und Desktop im Querformat.
576. Desktop-Fenster mit geringer Breite testen – auf 320–359 px Smartphone-Breite.
577. Desktop-Fenster mit geringer Breite testen – auf 360–429 px Smartphone-Breite.
578. Desktop-Fenster mit geringer Breite testen – auf großen Smartphones ab 430 px.
579. Desktop-Fenster mit geringer Breite testen – auf Tablets im Hochformat.
580. Desktop-Fenster mit geringer Breite testen – auf Tablets und Desktop im Querformat.
581. Ultrabreite Displays nicht endlos strecken – auf 320–359 px Smartphone-Breite.
582. Ultrabreite Displays nicht endlos strecken – auf 360–429 px Smartphone-Breite.
583. Ultrabreite Displays nicht endlos strecken – auf großen Smartphones ab 430 px.
584. Ultrabreite Displays nicht endlos strecken – auf Tablets im Hochformat.
585. Ultrabreite Displays nicht endlos strecken – auf Tablets und Desktop im Querformat.
586. Kurze Viewports kompakt darstellen – auf 320–359 px Smartphone-Breite.
587. Kurze Viewports kompakt darstellen – auf 360–429 px Smartphone-Breite.
588. Kurze Viewports kompakt darstellen – auf großen Smartphones ab 430 px.
589. Kurze Viewports kompakt darstellen – auf Tablets im Hochformat.
590. Kurze Viewports kompakt darstellen – auf Tablets und Desktop im Querformat.
591. Safe-Area an allen vier Seiten berücksichtigen – auf 320–359 px Smartphone-Breite.
592. Safe-Area an allen vier Seiten berücksichtigen – auf 360–429 px Smartphone-Breite.
593. Safe-Area an allen vier Seiten berücksichtigen – auf großen Smartphones ab 430 px.
594. Safe-Area an allen vier Seiten berücksichtigen – auf Tablets im Hochformat.
595. Safe-Area an allen vier Seiten berücksichtigen – auf Tablets und Desktop im Querformat.
596. Virtuelle Tastatur darf Edit-Felder nicht verdecken – auf 320–359 px Smartphone-Breite.
597. Virtuelle Tastatur darf Edit-Felder nicht verdecken – auf 360–429 px Smartphone-Breite.
598. Virtuelle Tastatur darf Edit-Felder nicht verdecken – auf großen Smartphones ab 430 px.
599. Virtuelle Tastatur darf Edit-Felder nicht verdecken – auf Tablets im Hochformat.
600. Virtuelle Tastatur darf Edit-Felder nicht verdecken – auf Tablets und Desktop im Querformat.

## Hintergründe

601. Wallpaper-Crop bei Hochformat prüfen – auf 320–359 px Smartphone-Breite.
602. Wallpaper-Crop bei Hochformat prüfen – auf 360–429 px Smartphone-Breite.
603. Wallpaper-Crop bei Hochformat prüfen – auf großen Smartphones ab 430 px.
604. Wallpaper-Crop bei Hochformat prüfen – auf Tablets im Hochformat.
605. Wallpaper-Crop bei Hochformat prüfen – auf Tablets und Desktop im Querformat.
606. Wallpaper-Crop bei Querformat prüfen – auf 320–359 px Smartphone-Breite.
607. Wallpaper-Crop bei Querformat prüfen – auf 360–429 px Smartphone-Breite.
608. Wallpaper-Crop bei Querformat prüfen – auf großen Smartphones ab 430 px.
609. Wallpaper-Crop bei Querformat prüfen – auf Tablets im Hochformat.
610. Wallpaper-Crop bei Querformat prüfen – auf Tablets und Desktop im Querformat.
611. Lesbarkeit mit hellen Fotos absichern – auf 320–359 px Smartphone-Breite.
612. Lesbarkeit mit hellen Fotos absichern – auf 360–429 px Smartphone-Breite.
613. Lesbarkeit mit hellen Fotos absichern – auf großen Smartphones ab 430 px.
614. Lesbarkeit mit hellen Fotos absichern – auf Tablets im Hochformat.
615. Lesbarkeit mit hellen Fotos absichern – auf Tablets und Desktop im Querformat.
616. Lesbarkeit mit dunklen Fotos absichern – auf 320–359 px Smartphone-Breite.
617. Lesbarkeit mit dunklen Fotos absichern – auf 360–429 px Smartphone-Breite.
618. Lesbarkeit mit dunklen Fotos absichern – auf großen Smartphones ab 430 px.
619. Lesbarkeit mit dunklen Fotos absichern – auf Tablets im Hochformat.
620. Lesbarkeit mit dunklen Fotos absichern – auf Tablets und Desktop im Querformat.
621. Defekte Bildquelle mit Fallback abfangen – auf 320–359 px Smartphone-Breite.
622. Defekte Bildquelle mit Fallback abfangen – auf 360–429 px Smartphone-Breite.
623. Defekte Bildquelle mit Fallback abfangen – auf großen Smartphones ab 430 px.
624. Defekte Bildquelle mit Fallback abfangen – auf Tablets im Hochformat.
625. Defekte Bildquelle mit Fallback abfangen – auf Tablets und Desktop im Querformat.
626. Hintergrundvorschau vor Übernahme zeigen – auf 320–359 px Smartphone-Breite.
627. Hintergrundvorschau vor Übernahme zeigen – auf 360–429 px Smartphone-Breite.
628. Hintergrundvorschau vor Übernahme zeigen – auf großen Smartphones ab 430 px.
629. Hintergrundvorschau vor Übernahme zeigen – auf Tablets im Hochformat.
630. Hintergrundvorschau vor Übernahme zeigen – auf Tablets und Desktop im Querformat.
631. Reset-Aktion eindeutig kennzeichnen – auf 320–359 px Smartphone-Breite.
632. Reset-Aktion eindeutig kennzeichnen – auf 360–429 px Smartphone-Breite.
633. Reset-Aktion eindeutig kennzeichnen – auf großen Smartphones ab 430 px.
634. Reset-Aktion eindeutig kennzeichnen – auf Tablets im Hochformat.
635. Reset-Aktion eindeutig kennzeichnen – auf Tablets und Desktop im Querformat.
636. Große Upload-Bilder effizient behandeln – auf 320–359 px Smartphone-Breite.
637. Große Upload-Bilder effizient behandeln – auf 360–429 px Smartphone-Breite.
638. Große Upload-Bilder effizient behandeln – auf großen Smartphones ab 430 px.
639. Große Upload-Bilder effizient behandeln – auf Tablets im Hochformat.
640. Große Upload-Bilder effizient behandeln – auf Tablets und Desktop im Querformat.
641. Overlay ohne Farbverschiebung der Icons gestalten – auf 320–359 px Smartphone-Breite.
642. Overlay ohne Farbverschiebung der Icons gestalten – auf 360–429 px Smartphone-Breite.
643. Overlay ohne Farbverschiebung der Icons gestalten – auf großen Smartphones ab 430 px.
644. Overlay ohne Farbverschiebung der Icons gestalten – auf Tablets im Hochformat.
645. Overlay ohne Farbverschiebung der Icons gestalten – auf Tablets und Desktop im Querformat.
646. Mira-Aktion auf jedem Hintergrund sichtbar halten – auf 320–359 px Smartphone-Breite.
647. Mira-Aktion auf jedem Hintergrund sichtbar halten – auf 360–429 px Smartphone-Breite.
648. Mira-Aktion auf jedem Hintergrund sichtbar halten – auf großen Smartphones ab 430 px.
649. Mira-Aktion auf jedem Hintergrund sichtbar halten – auf Tablets im Hochformat.
650. Mira-Aktion auf jedem Hintergrund sichtbar halten – auf Tablets und Desktop im Querformat.

## Zustände und Feedback

651. Disabled-Zustände verständlich darstellen – auf 320–359 px Smartphone-Breite.
652. Disabled-Zustände verständlich darstellen – auf 360–429 px Smartphone-Breite.
653. Disabled-Zustände verständlich darstellen – auf großen Smartphones ab 430 px.
654. Disabled-Zustände verständlich darstellen – auf Tablets im Hochformat.
655. Disabled-Zustände verständlich darstellen – auf Tablets und Desktop im Querformat.
656. Ladezustände ohne Layoutsprung zeigen – auf 320–359 px Smartphone-Breite.
657. Ladezustände ohne Layoutsprung zeigen – auf 360–429 px Smartphone-Breite.
658. Ladezustände ohne Layoutsprung zeigen – auf großen Smartphones ab 430 px.
659. Ladezustände ohne Layoutsprung zeigen – auf Tablets im Hochformat.
660. Ladezustände ohne Layoutsprung zeigen – auf Tablets und Desktop im Querformat.
661. Offline-Zustand sichtbar kommunizieren – auf 320–359 px Smartphone-Breite.
662. Offline-Zustand sichtbar kommunizieren – auf 360–429 px Smartphone-Breite.
663. Offline-Zustand sichtbar kommunizieren – auf großen Smartphones ab 430 px.
664. Offline-Zustand sichtbar kommunizieren – auf Tablets im Hochformat.
665. Offline-Zustand sichtbar kommunizieren – auf Tablets und Desktop im Querformat.
666. Veraltete Widget-Daten kennzeichnen – auf 320–359 px Smartphone-Breite.
667. Veraltete Widget-Daten kennzeichnen – auf 360–429 px Smartphone-Breite.
668. Veraltete Widget-Daten kennzeichnen – auf großen Smartphones ab 430 px.
669. Veraltete Widget-Daten kennzeichnen – auf Tablets im Hochformat.
670. Veraltete Widget-Daten kennzeichnen – auf Tablets und Desktop im Querformat.
671. Leere App-Gruppen erklären – auf 320–359 px Smartphone-Breite.
672. Leere App-Gruppen erklären – auf 360–429 px Smartphone-Breite.
673. Leere App-Gruppen erklären – auf großen Smartphones ab 430 px.
674. Leere App-Gruppen erklären – auf Tablets im Hochformat.
675. Leere App-Gruppen erklären – auf Tablets und Desktop im Querformat.
676. Keine Suchtreffer mit nächstem Schritt erklären – auf 320–359 px Smartphone-Breite.
677. Keine Suchtreffer mit nächstem Schritt erklären – auf 360–429 px Smartphone-Breite.
678. Keine Suchtreffer mit nächstem Schritt erklären – auf großen Smartphones ab 430 px.
679. Keine Suchtreffer mit nächstem Schritt erklären – auf Tablets im Hochformat.
680. Keine Suchtreffer mit nächstem Schritt erklären – auf Tablets und Desktop im Querformat.
681. Speicherfehler konkret formulieren – auf 320–359 px Smartphone-Breite.
682. Speicherfehler konkret formulieren – auf 360–429 px Smartphone-Breite.
683. Speicherfehler konkret formulieren – auf großen Smartphones ab 430 px.
684. Speicherfehler konkret formulieren – auf Tablets im Hochformat.
685. Speicherfehler konkret formulieren – auf Tablets und Desktop im Querformat.
686. Erfolgsfeedback kurz und eindeutig anzeigen – auf 320–359 px Smartphone-Breite.
687. Erfolgsfeedback kurz und eindeutig anzeigen – auf 360–429 px Smartphone-Breite.
688. Erfolgsfeedback kurz und eindeutig anzeigen – auf großen Smartphones ab 430 px.
689. Erfolgsfeedback kurz und eindeutig anzeigen – auf Tablets im Hochformat.
690. Erfolgsfeedback kurz und eindeutig anzeigen – auf Tablets und Desktop im Querformat.
691. Undo für reversible Aktionen vorsehen – auf 320–359 px Smartphone-Breite.
692. Undo für reversible Aktionen vorsehen – auf 360–429 px Smartphone-Breite.
693. Undo für reversible Aktionen vorsehen – auf großen Smartphones ab 430 px.
694. Undo für reversible Aktionen vorsehen – auf Tablets im Hochformat.
695. Undo für reversible Aktionen vorsehen – auf Tablets und Desktop im Querformat.
696. Badge-Werte bei Null ausblenden – auf 320–359 px Smartphone-Breite.
697. Badge-Werte bei Null ausblenden – auf 360–429 px Smartphone-Breite.
698. Badge-Werte bei Null ausblenden – auf großen Smartphones ab 430 px.
699. Badge-Werte bei Null ausblenden – auf Tablets im Hochformat.
700. Badge-Werte bei Null ausblenden – auf Tablets und Desktop im Querformat.

## Performance

701. Icon-Bildabmessungen früh reservieren – auf 320–359 px Smartphone-Breite.
702. Icon-Bildabmessungen früh reservieren – auf 360–429 px Smartphone-Breite.
703. Icon-Bildabmessungen früh reservieren – auf großen Smartphones ab 430 px.
704. Icon-Bildabmessungen früh reservieren – auf Tablets im Hochformat.
705. Icon-Bildabmessungen früh reservieren – auf Tablets und Desktop im Querformat.
706. Wallpaper-Assets optimieren – auf 320–359 px Smartphone-Breite.
707. Wallpaper-Assets optimieren – auf 360–429 px Smartphone-Breite.
708. Wallpaper-Assets optimieren – auf großen Smartphones ab 430 px.
709. Wallpaper-Assets optimieren – auf Tablets im Hochformat.
710. Wallpaper-Assets optimieren – auf Tablets und Desktop im Querformat.
711. Blur-Effekte auf schwachen Geräten reduzieren – auf 320–359 px Smartphone-Breite.
712. Blur-Effekte auf schwachen Geräten reduzieren – auf 360–429 px Smartphone-Breite.
713. Blur-Effekte auf schwachen Geräten reduzieren – auf großen Smartphones ab 430 px.
714. Blur-Effekte auf schwachen Geräten reduzieren – auf Tablets im Hochformat.
715. Blur-Effekte auf schwachen Geräten reduzieren – auf Tablets und Desktop im Querformat.
716. Animationen auf transform und opacity begrenzen – auf 320–359 px Smartphone-Breite.
717. Animationen auf transform und opacity begrenzen – auf 360–429 px Smartphone-Breite.
718. Animationen auf transform und opacity begrenzen – auf großen Smartphones ab 430 px.
719. Animationen auf transform und opacity begrenzen – auf Tablets im Hochformat.
720. Animationen auf transform und opacity begrenzen – auf Tablets und Desktop im Querformat.
721. Große App-Listen ohne unnötige Layoutarbeit rendern – auf 320–359 px Smartphone-Breite.
722. Große App-Listen ohne unnötige Layoutarbeit rendern – auf 360–429 px Smartphone-Breite.
723. Große App-Listen ohne unnötige Layoutarbeit rendern – auf großen Smartphones ab 430 px.
724. Große App-Listen ohne unnötige Layoutarbeit rendern – auf Tablets im Hochformat.
725. Große App-Listen ohne unnötige Layoutarbeit rendern – auf Tablets und Desktop im Querformat.
726. Widget-Daten nicht häufiger als nötig aktualisieren – auf 320–359 px Smartphone-Breite.
727. Widget-Daten nicht häufiger als nötig aktualisieren – auf 360–429 px Smartphone-Breite.
728. Widget-Daten nicht häufiger als nötig aktualisieren – auf großen Smartphones ab 430 px.
729. Widget-Daten nicht häufiger als nötig aktualisieren – auf Tablets im Hochformat.
730. Widget-Daten nicht häufiger als nötig aktualisieren – auf Tablets und Desktop im Querformat.
731. SVG-Dateien auf unnötige Filter prüfen – auf 320–359 px Smartphone-Breite.
732. SVG-Dateien auf unnötige Filter prüfen – auf 360–429 px Smartphone-Breite.
733. SVG-Dateien auf unnötige Filter prüfen – auf großen Smartphones ab 430 px.
734. SVG-Dateien auf unnötige Filter prüfen – auf Tablets im Hochformat.
735. SVG-Dateien auf unnötige Filter prüfen – auf Tablets und Desktop im Querformat.
736. Schwere Schatten auf Mobilgeräten reduzieren – auf 320–359 px Smartphone-Breite.
737. Schwere Schatten auf Mobilgeräten reduzieren – auf 360–429 px Smartphone-Breite.
738. Schwere Schatten auf Mobilgeräten reduzieren – auf großen Smartphones ab 430 px.
739. Schwere Schatten auf Mobilgeräten reduzieren – auf Tablets im Hochformat.
740. Schwere Schatten auf Mobilgeräten reduzieren – auf Tablets und Desktop im Querformat.
741. CSS-Selektoren auf Launcher begrenzen – auf 320–359 px Smartphone-Breite.
742. CSS-Selektoren auf Launcher begrenzen – auf 360–429 px Smartphone-Breite.
743. CSS-Selektoren auf Launcher begrenzen – auf großen Smartphones ab 430 px.
744. CSS-Selektoren auf Launcher begrenzen – auf Tablets im Hochformat.
745. CSS-Selektoren auf Launcher begrenzen – auf Tablets und Desktop im Querformat.
746. Visuelle Regressionen über Screenshots erkennen – auf 320–359 px Smartphone-Breite.
747. Visuelle Regressionen über Screenshots erkennen – auf 360–429 px Smartphone-Breite.
748. Visuelle Regressionen über Screenshots erkennen – auf großen Smartphones ab 430 px.
749. Visuelle Regressionen über Screenshots erkennen – auf Tablets im Hochformat.
750. Visuelle Regressionen über Screenshots erkennen – auf Tablets und Desktop im Querformat.

## Laden und Offline

751. Skeletons nur bei ausreichend langer Ladezeit zeigen – auf 320–359 px Smartphone-Breite.
752. Skeletons nur bei ausreichend langer Ladezeit zeigen – auf 360–429 px Smartphone-Breite.
753. Skeletons nur bei ausreichend langer Ladezeit zeigen – auf großen Smartphones ab 430 px.
754. Skeletons nur bei ausreichend langer Ladezeit zeigen – auf Tablets im Hochformat.
755. Skeletons nur bei ausreichend langer Ladezeit zeigen – auf Tablets und Desktop im Querformat.
756. Fehlgeschlagene Widget-Anfragen erneut versuchen lassen – auf 320–359 px Smartphone-Breite.
757. Fehlgeschlagene Widget-Anfragen erneut versuchen lassen – auf 360–429 px Smartphone-Breite.
758. Fehlgeschlagene Widget-Anfragen erneut versuchen lassen – auf großen Smartphones ab 430 px.
759. Fehlgeschlagene Widget-Anfragen erneut versuchen lassen – auf Tablets im Hochformat.
760. Fehlgeschlagene Widget-Anfragen erneut versuchen lassen – auf Tablets und Desktop im Querformat.
761. Offline-Hinweis ohne Modal anzeigen – auf 320–359 px Smartphone-Breite.
762. Offline-Hinweis ohne Modal anzeigen – auf 360–429 px Smartphone-Breite.
763. Offline-Hinweis ohne Modal anzeigen – auf großen Smartphones ab 430 px.
764. Offline-Hinweis ohne Modal anzeigen – auf Tablets im Hochformat.
765. Offline-Hinweis ohne Modal anzeigen – auf Tablets und Desktop im Querformat.
766. Zwischengespeicherte Daten als solche kennzeichnen – auf 320–359 px Smartphone-Breite.
767. Zwischengespeicherte Daten als solche kennzeichnen – auf 360–429 px Smartphone-Breite.
768. Zwischengespeicherte Daten als solche kennzeichnen – auf großen Smartphones ab 430 px.
769. Zwischengespeicherte Daten als solche kennzeichnen – auf Tablets im Hochformat.
770. Zwischengespeicherte Daten als solche kennzeichnen – auf Tablets und Desktop im Querformat.
771. Veraltete Inhalte nicht als aktuell ausgeben – auf 320–359 px Smartphone-Breite.
772. Veraltete Inhalte nicht als aktuell ausgeben – auf 360–429 px Smartphone-Breite.
773. Veraltete Inhalte nicht als aktuell ausgeben – auf großen Smartphones ab 430 px.
774. Veraltete Inhalte nicht als aktuell ausgeben – auf Tablets im Hochformat.
775. Veraltete Inhalte nicht als aktuell ausgeben – auf Tablets und Desktop im Querformat.
776. Ladeindikatoren an der betroffenen Stelle zeigen – auf 320–359 px Smartphone-Breite.
777. Ladeindikatoren an der betroffenen Stelle zeigen – auf 360–429 px Smartphone-Breite.
778. Ladeindikatoren an der betroffenen Stelle zeigen – auf großen Smartphones ab 430 px.
779. Ladeindikatoren an der betroffenen Stelle zeigen – auf Tablets im Hochformat.
780. Ladeindikatoren an der betroffenen Stelle zeigen – auf Tablets und Desktop im Querformat.
781. Wiederholungsaktion erreichbar halten – auf 320–359 px Smartphone-Breite.
782. Wiederholungsaktion erreichbar halten – auf 360–429 px Smartphone-Breite.
783. Wiederholungsaktion erreichbar halten – auf großen Smartphones ab 430 px.
784. Wiederholungsaktion erreichbar halten – auf Tablets im Hochformat.
785. Wiederholungsaktion erreichbar halten – auf Tablets und Desktop im Querformat.
786. Netzwerkfehler verständlich übersetzen – auf 320–359 px Smartphone-Breite.
787. Netzwerkfehler verständlich übersetzen – auf 360–429 px Smartphone-Breite.
788. Netzwerkfehler verständlich übersetzen – auf großen Smartphones ab 430 px.
789. Netzwerkfehler verständlich übersetzen – auf Tablets im Hochformat.
790. Netzwerkfehler verständlich übersetzen – auf Tablets und Desktop im Querformat.
791. Teilweise geladene Homepage stabil darstellen – auf 320–359 px Smartphone-Breite.
792. Teilweise geladene Homepage stabil darstellen – auf 360–429 px Smartphone-Breite.
793. Teilweise geladene Homepage stabil darstellen – auf großen Smartphones ab 430 px.
794. Teilweise geladene Homepage stabil darstellen – auf Tablets im Hochformat.
795. Teilweise geladene Homepage stabil darstellen – auf Tablets und Desktop im Querformat.
796. Ladezustand für Screenreader ankündigen – auf 320–359 px Smartphone-Breite.
797. Ladezustand für Screenreader ankündigen – auf 360–429 px Smartphone-Breite.
798. Ladezustand für Screenreader ankündigen – auf großen Smartphones ab 430 px.
799. Ladezustand für Screenreader ankündigen – auf Tablets im Hochformat.
800. Ladezustand für Screenreader ankündigen – auf Tablets und Desktop im Querformat.

## Suche und Auffindbarkeit

801. Suchfeld mit Tastaturfokus öffnen – auf 320–359 px Smartphone-Breite.
802. Suchfeld mit Tastaturfokus öffnen – auf 360–429 px Smartphone-Breite.
803. Suchfeld mit Tastaturfokus öffnen – auf großen Smartphones ab 430 px.
804. Suchfeld mit Tastaturfokus öffnen – auf Tablets im Hochformat.
805. Suchfeld mit Tastaturfokus öffnen – auf Tablets und Desktop im Querformat.
806. Suchanfragen ohne Treffer erklären – auf 320–359 px Smartphone-Breite.
807. Suchanfragen ohne Treffer erklären – auf 360–429 px Smartphone-Breite.
808. Suchanfragen ohne Treffer erklären – auf großen Smartphones ab 430 px.
809. Suchanfragen ohne Treffer erklären – auf Tablets im Hochformat.
810. Suchanfragen ohne Treffer erklären – auf Tablets und Desktop im Querformat.
811. Ergebnisse nach App-Namen sortierbar machen – auf 320–359 px Smartphone-Breite.
812. Ergebnisse nach App-Namen sortierbar machen – auf 360–429 px Smartphone-Breite.
813. Ergebnisse nach App-Namen sortierbar machen – auf großen Smartphones ab 430 px.
814. Ergebnisse nach App-Namen sortierbar machen – auf Tablets im Hochformat.
815. Ergebnisse nach App-Namen sortierbar machen – auf Tablets und Desktop im Querformat.
816. Suchergebnisse per Tastatur öffnen – auf 320–359 px Smartphone-Breite.
817. Suchergebnisse per Tastatur öffnen – auf 360–429 px Smartphone-Breite.
818. Suchergebnisse per Tastatur öffnen – auf großen Smartphones ab 430 px.
819. Suchergebnisse per Tastatur öffnen – auf Tablets im Hochformat.
820. Suchergebnisse per Tastatur öffnen – auf Tablets und Desktop im Querformat.
821. Suchdialog auf kleinen Displays anpassen – auf 320–359 px Smartphone-Breite.
822. Suchdialog auf kleinen Displays anpassen – auf 360–429 px Smartphone-Breite.
823. Suchdialog auf kleinen Displays anpassen – auf großen Smartphones ab 430 px.
824. Suchdialog auf kleinen Displays anpassen – auf Tablets im Hochformat.
825. Suchdialog auf kleinen Displays anpassen – auf Tablets und Desktop im Querformat.
826. Suchfeld mit Escape schließen – auf 320–359 px Smartphone-Breite.
827. Suchfeld mit Escape schließen – auf 360–429 px Smartphone-Breite.
828. Suchfeld mit Escape schließen – auf großen Smartphones ab 430 px.
829. Suchfeld mit Escape schließen – auf Tablets im Hochformat.
830. Suchfeld mit Escape schließen – auf Tablets und Desktop im Querformat.
831. Suchzustand visuell kennzeichnen – auf 320–359 px Smartphone-Breite.
832. Suchzustand visuell kennzeichnen – auf 360–429 px Smartphone-Breite.
833. Suchzustand visuell kennzeichnen – auf großen Smartphones ab 430 px.
834. Suchzustand visuell kennzeichnen – auf Tablets im Hochformat.
835. Suchzustand visuell kennzeichnen – auf Tablets und Desktop im Querformat.
836. Lange App-Namen in Treffern umbrechen – auf 320–359 px Smartphone-Breite.
837. Lange App-Namen in Treffern umbrechen – auf 360–429 px Smartphone-Breite.
838. Lange App-Namen in Treffern umbrechen – auf großen Smartphones ab 430 px.
839. Lange App-Namen in Treffern umbrechen – auf Tablets im Hochformat.
840. Lange App-Namen in Treffern umbrechen – auf Tablets und Desktop im Querformat.
841. Suchergebnisse nicht doppelt darstellen – auf 320–359 px Smartphone-Breite.
842. Suchergebnisse nicht doppelt darstellen – auf 360–429 px Smartphone-Breite.
843. Suchergebnisse nicht doppelt darstellen – auf großen Smartphones ab 430 px.
844. Suchergebnisse nicht doppelt darstellen – auf Tablets im Hochformat.
845. Suchergebnisse nicht doppelt darstellen – auf Tablets und Desktop im Querformat.
846. Suchaktion aus dem Header gut erreichbar halten – auf 320–359 px Smartphone-Breite.
847. Suchaktion aus dem Header gut erreichbar halten – auf 360–429 px Smartphone-Breite.
848. Suchaktion aus dem Header gut erreichbar halten – auf großen Smartphones ab 430 px.
849. Suchaktion aus dem Header gut erreichbar halten – auf Tablets im Hochformat.
850. Suchaktion aus dem Header gut erreichbar halten – auf Tablets und Desktop im Querformat.

## Favoriten und Gruppen

851. Favoriten visuell klar von normalen Apps trennen – auf 320–359 px Smartphone-Breite.
852. Favoriten visuell klar von normalen Apps trennen – auf 360–429 px Smartphone-Breite.
853. Favoriten visuell klar von normalen Apps trennen – auf großen Smartphones ab 430 px.
854. Favoriten visuell klar von normalen Apps trennen – auf Tablets im Hochformat.
855. Favoriten visuell klar von normalen Apps trennen – auf Tablets und Desktop im Querformat.
856. Gruppenüberschriften eindeutig benennen – auf 320–359 px Smartphone-Breite.
857. Gruppenüberschriften eindeutig benennen – auf 360–429 px Smartphone-Breite.
858. Gruppenüberschriften eindeutig benennen – auf großen Smartphones ab 430 px.
859. Gruppenüberschriften eindeutig benennen – auf Tablets im Hochformat.
860. Gruppenüberschriften eindeutig benennen – auf Tablets und Desktop im Querformat.
861. Leere Gruppen ohne tote Fläche darstellen – auf 320–359 px Smartphone-Breite.
862. Leere Gruppen ohne tote Fläche darstellen – auf 360–429 px Smartphone-Breite.
863. Leere Gruppen ohne tote Fläche darstellen – auf großen Smartphones ab 430 px.
864. Leere Gruppen ohne tote Fläche darstellen – auf Tablets im Hochformat.
865. Leere Gruppen ohne tote Fläche darstellen – auf Tablets und Desktop im Querformat.
866. Gruppen einklappen ohne Scrollsprung – auf 320–359 px Smartphone-Breite.
867. Gruppen einklappen ohne Scrollsprung – auf 360–429 px Smartphone-Breite.
868. Gruppen einklappen ohne Scrollsprung – auf großen Smartphones ab 430 px.
869. Gruppen einklappen ohne Scrollsprung – auf Tablets im Hochformat.
870. Gruppen einklappen ohne Scrollsprung – auf Tablets und Desktop im Querformat.
871. Favoritenreihenfolge nach Drag speichern – auf 320–359 px Smartphone-Breite.
872. Favoritenreihenfolge nach Drag speichern – auf 360–429 px Smartphone-Breite.
873. Favoritenreihenfolge nach Drag speichern – auf großen Smartphones ab 430 px.
874. Favoritenreihenfolge nach Drag speichern – auf Tablets im Hochformat.
875. Favoritenreihenfolge nach Drag speichern – auf Tablets und Desktop im Querformat.
876. Gruppenaktionen mit Accessible Names versehen – auf 320–359 px Smartphone-Breite.
877. Gruppenaktionen mit Accessible Names versehen – auf 360–429 px Smartphone-Breite.
878. Gruppenaktionen mit Accessible Names versehen – auf großen Smartphones ab 430 px.
879. Gruppenaktionen mit Accessible Names versehen – auf Tablets im Hochformat.
880. Gruppenaktionen mit Accessible Names versehen – auf Tablets und Desktop im Querformat.
881. App nicht versehentlich in sich selbst ablegen – auf 320–359 px Smartphone-Breite.
882. App nicht versehentlich in sich selbst ablegen – auf 360–429 px Smartphone-Breite.
883. App nicht versehentlich in sich selbst ablegen – auf großen Smartphones ab 430 px.
884. App nicht versehentlich in sich selbst ablegen – auf Tablets im Hochformat.
885. App nicht versehentlich in sich selbst ablegen – auf Tablets und Desktop im Querformat.
886. Ordnerzustände visuell klar unterscheiden – auf 320–359 px Smartphone-Breite.
887. Ordnerzustände visuell klar unterscheiden – auf 360–429 px Smartphone-Breite.
888. Ordnerzustände visuell klar unterscheiden – auf großen Smartphones ab 430 px.
889. Ordnerzustände visuell klar unterscheiden – auf Tablets im Hochformat.
890. Ordnerzustände visuell klar unterscheiden – auf Tablets und Desktop im Querformat.
891. Gruppen über Seiten hinweg stabil halten – auf 320–359 px Smartphone-Breite.
892. Gruppen über Seiten hinweg stabil halten – auf 360–429 px Smartphone-Breite.
893. Gruppen über Seiten hinweg stabil halten – auf großen Smartphones ab 430 px.
894. Gruppen über Seiten hinweg stabil halten – auf Tablets im Hochformat.
895. Gruppen über Seiten hinweg stabil halten – auf Tablets und Desktop im Querformat.
896. Änderungen an Favoriten rückgängig machen – auf 320–359 px Smartphone-Breite.
897. Änderungen an Favoriten rückgängig machen – auf 360–429 px Smartphone-Breite.
898. Änderungen an Favoriten rückgängig machen – auf großen Smartphones ab 430 px.
899. Änderungen an Favoriten rückgängig machen – auf Tablets im Hochformat.
900. Änderungen an Favoriten rückgängig machen – auf Tablets und Desktop im Querformat.

## Personalisierung

901. Sechs vorhandene Designstile konsistent halten – auf 320–359 px Smartphone-Breite.
902. Sechs vorhandene Designstile konsistent halten – auf 360–429 px Smartphone-Breite.
903. Sechs vorhandene Designstile konsistent halten – auf großen Smartphones ab 430 px.
904. Sechs vorhandene Designstile konsistent halten – auf Tablets im Hochformat.
905. Sechs vorhandene Designstile konsistent halten – auf Tablets und Desktop im Querformat.
906. 13 Farbwelten auf Kontrast prüfen – auf 320–359 px Smartphone-Breite.
907. 13 Farbwelten auf Kontrast prüfen – auf 360–429 px Smartphone-Breite.
908. 13 Farbwelten auf Kontrast prüfen – auf großen Smartphones ab 430 px.
909. 13 Farbwelten auf Kontrast prüfen – auf Tablets im Hochformat.
910. 13 Farbwelten auf Kontrast prüfen – auf Tablets und Desktop im Querformat.
911. Wallpaper-Einstellungen verständlich gruppieren – auf 320–359 px Smartphone-Breite.
912. Wallpaper-Einstellungen verständlich gruppieren – auf 360–429 px Smartphone-Breite.
913. Wallpaper-Einstellungen verständlich gruppieren – auf großen Smartphones ab 430 px.
914. Wallpaper-Einstellungen verständlich gruppieren – auf Tablets im Hochformat.
915. Wallpaper-Einstellungen verständlich gruppieren – auf Tablets und Desktop im Querformat.
916. Icon-Größen mit sichtbarer Vorschau anbieten – auf 320–359 px Smartphone-Breite.
917. Icon-Größen mit sichtbarer Vorschau anbieten – auf 360–429 px Smartphone-Breite.
918. Icon-Größen mit sichtbarer Vorschau anbieten – auf großen Smartphones ab 430 px.
919. Icon-Größen mit sichtbarer Vorschau anbieten – auf Tablets im Hochformat.
920. Icon-Größen mit sichtbarer Vorschau anbieten – auf Tablets und Desktop im Querformat.
921. Widget-Größen vor Auswahl erklären – auf 320–359 px Smartphone-Breite.
922. Widget-Größen vor Auswahl erklären – auf 360–429 px Smartphone-Breite.
923. Widget-Größen vor Auswahl erklären – auf großen Smartphones ab 430 px.
924. Widget-Größen vor Auswahl erklären – auf Tablets im Hochformat.
925. Widget-Größen vor Auswahl erklären – auf Tablets und Desktop im Querformat.
926. Layout-Presets mit Vorschau versehen – auf 320–359 px Smartphone-Breite.
927. Layout-Presets mit Vorschau versehen – auf 360–429 px Smartphone-Breite.
928. Layout-Presets mit Vorschau versehen – auf großen Smartphones ab 430 px.
929. Layout-Presets mit Vorschau versehen – auf Tablets im Hochformat.
930. Layout-Presets mit Vorschau versehen – auf Tablets und Desktop im Querformat.
931. Zurücksetzen mit Bestätigung absichern – auf 320–359 px Smartphone-Breite.
932. Zurücksetzen mit Bestätigung absichern – auf 360–429 px Smartphone-Breite.
933. Zurücksetzen mit Bestätigung absichern – auf großen Smartphones ab 430 px.
934. Zurücksetzen mit Bestätigung absichern – auf Tablets im Hochformat.
935. Zurücksetzen mit Bestätigung absichern – auf Tablets und Desktop im Querformat.
936. Gespeicherte Layouts eindeutig benennen – auf 320–359 px Smartphone-Breite.
937. Gespeicherte Layouts eindeutig benennen – auf 360–429 px Smartphone-Breite.
938. Gespeicherte Layouts eindeutig benennen – auf großen Smartphones ab 430 px.
939. Gespeicherte Layouts eindeutig benennen – auf Tablets im Hochformat.
940. Gespeicherte Layouts eindeutig benennen – auf Tablets und Desktop im Querformat.
941. Personalisierung ohne Reload übernehmen – auf 320–359 px Smartphone-Breite.
942. Personalisierung ohne Reload übernehmen – auf 360–429 px Smartphone-Breite.
943. Personalisierung ohne Reload übernehmen – auf großen Smartphones ab 430 px.
944. Personalisierung ohne Reload übernehmen – auf Tablets im Hochformat.
945. Personalisierung ohne Reload übernehmen – auf Tablets und Desktop im Querformat.
946. Einstellungen bei Theme-Wechsel erhalten – auf 320–359 px Smartphone-Breite.
947. Einstellungen bei Theme-Wechsel erhalten – auf 360–429 px Smartphone-Breite.
948. Einstellungen bei Theme-Wechsel erhalten – auf großen Smartphones ab 430 px.
949. Einstellungen bei Theme-Wechsel erhalten – auf Tablets im Hochformat.
950. Einstellungen bei Theme-Wechsel erhalten – auf Tablets und Desktop im Querformat.

## Qualitätssicherung

951. Screenshots bei 320 Pixeln vergleichen – auf 320–359 px Smartphone-Breite.
952. Screenshots bei 320 Pixeln vergleichen – auf 360–429 px Smartphone-Breite.
953. Screenshots bei 320 Pixeln vergleichen – auf großen Smartphones ab 430 px.
954. Screenshots bei 320 Pixeln vergleichen – auf Tablets im Hochformat.
955. Screenshots bei 320 Pixeln vergleichen – auf Tablets und Desktop im Querformat.
956. Screenshots bei 360 Pixeln vergleichen – auf 320–359 px Smartphone-Breite.
957. Screenshots bei 360 Pixeln vergleichen – auf 360–429 px Smartphone-Breite.
958. Screenshots bei 360 Pixeln vergleichen – auf großen Smartphones ab 430 px.
959. Screenshots bei 360 Pixeln vergleichen – auf Tablets im Hochformat.
960. Screenshots bei 360 Pixeln vergleichen – auf Tablets und Desktop im Querformat.
961. Screenshots bei 430 Pixeln vergleichen – auf 320–359 px Smartphone-Breite.
962. Screenshots bei 430 Pixeln vergleichen – auf 360–429 px Smartphone-Breite.
963. Screenshots bei 430 Pixeln vergleichen – auf großen Smartphones ab 430 px.
964. Screenshots bei 430 Pixeln vergleichen – auf Tablets im Hochformat.
965. Screenshots bei 430 Pixeln vergleichen – auf Tablets und Desktop im Querformat.
966. Tablet-Hochformat visuell prüfen – auf 320–359 px Smartphone-Breite.
967. Tablet-Hochformat visuell prüfen – auf 360–429 px Smartphone-Breite.
968. Tablet-Hochformat visuell prüfen – auf großen Smartphones ab 430 px.
969. Tablet-Hochformat visuell prüfen – auf Tablets im Hochformat.
970. Tablet-Hochformat visuell prüfen – auf Tablets und Desktop im Querformat.
971. Tablet-Querformat visuell prüfen – auf 320–359 px Smartphone-Breite.
972. Tablet-Querformat visuell prüfen – auf 360–429 px Smartphone-Breite.
973. Tablet-Querformat visuell prüfen – auf großen Smartphones ab 430 px.
974. Tablet-Querformat visuell prüfen – auf Tablets im Hochformat.
975. Tablet-Querformat visuell prüfen – auf Tablets und Desktop im Querformat.
976. Desktop-Breite visuell prüfen – auf 320–359 px Smartphone-Breite.
977. Desktop-Breite visuell prüfen – auf 360–429 px Smartphone-Breite.
978. Desktop-Breite visuell prüfen – auf großen Smartphones ab 430 px.
979. Desktop-Breite visuell prüfen – auf Tablets im Hochformat.
980. Desktop-Breite visuell prüfen – auf Tablets und Desktop im Querformat.
981. Tastatur-Fokusabläufe automatisieren – auf 320–359 px Smartphone-Breite.
982. Tastatur-Fokusabläufe automatisieren – auf 360–429 px Smartphone-Breite.
983. Tastatur-Fokusabläufe automatisieren – auf großen Smartphones ab 430 px.
984. Tastatur-Fokusabläufe automatisieren – auf Tablets im Hochformat.
985. Tastatur-Fokusabläufe automatisieren – auf Tablets und Desktop im Querformat.
986. Reduced-Motion-Ansicht prüfen – auf 320–359 px Smartphone-Breite.
987. Reduced-Motion-Ansicht prüfen – auf 360–429 px Smartphone-Breite.
988. Reduced-Motion-Ansicht prüfen – auf großen Smartphones ab 430 px.
989. Reduced-Motion-Ansicht prüfen – auf Tablets im Hochformat.
990. Reduced-Motion-Ansicht prüfen – auf Tablets und Desktop im Querformat.
991. Forced-Colors-Ansicht prüfen – auf 320–359 px Smartphone-Breite.
992. Forced-Colors-Ansicht prüfen – auf 360–429 px Smartphone-Breite.
993. Forced-Colors-Ansicht prüfen – auf großen Smartphones ab 430 px.
994. Forced-Colors-Ansicht prüfen – auf Tablets im Hochformat.
995. Forced-Colors-Ansicht prüfen – auf Tablets und Desktop im Querformat.
996. Touch-Interaktionen auf echtem Gerät testen – auf 320–359 px Smartphone-Breite.
997. Touch-Interaktionen auf echtem Gerät testen – auf 360–429 px Smartphone-Breite.
998. Touch-Interaktionen auf echtem Gerät testen – auf großen Smartphones ab 430 px.
999. Touch-Interaktionen auf echtem Gerät testen – auf Tablets im Hochformat.
1000. Touch-Interaktionen auf echtem Gerät testen – auf Tablets und Desktop im Querformat.
