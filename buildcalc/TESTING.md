# BuildCalc — Informe de pruebas (ejecutadas realmente)

**Fecha:** 2026-11-11 · **Entorno:** Node v20.20.2, Playwright 1.x + Chromium headless shell 158, Lighthouse 12 (emulación móvil)

## Resumen

| Suite | Comando | Resultado |
|---|---|---|
| Unitarias (núcleo: unidades, validación, 3 calculadoras) | `npm run test:unit` | **25 / 25 ✅** |
| Build / SEO / i18n / enlaces / presupuesto de peso | `npm run test:build` | **13 / 13 ✅** |
| E2E en Chromium real (cálculo, validación, unidades, idiomas, móvil, a11y) | `node --test tests/e2e/` | **19 / 19 ✅** |
| Lighthouse móvil (`/es/hormigon/`, `/en/paint/`, `/es/pisos/`, `/en/`) | manual | Performance **99–100** · Accessibility **100** · Best Practices **100** · SEO **100** · CLS 0 · TBT 0 ms |

## Valores de referencia verificados

| Caso | Esperado | Obtenido |
|---|---|---|
| Losa 10 × 10 ft × 4 in | 1.235 yd³ (referencia de la industria) | 1.235 yd³ (33.33 ft³) ✅ |
| 1 yd³ en sacos de 80 lb | 45 sacos | 45 ✅ (tras corregir la constante de rendimiento, ver "Errores encontrados") |
| Losa 5 × 4 m × 10 cm + 5 % | 2.1 m³, 90 sacos de 50 kg | 2,1 m³ · 90 ✅ |
| Columna Ø30 cm × 3 m × 4 | 0.848 m³ | ✅ |
| Pintura 4 × 3 × 2.5 m, 1 puerta, 1 ventana, 2 manos, 10 m²/L, 5 % | 31.6 m² netos, 6.64 L, 2 envases de 4 L | ✅ |
| Pintura 12 × 10 × 8 ft, 350 ft²/gal | 1.89 gal; +techo → 2.61 gal; área 350 ft² 1 mano → 1.00 gal | ✅ |
| Piso 5 × 4 m, 10 %, 60 × 60 cm, 4/caja | 22 m², 62 piezas, 16 cajas | ✅ |
| Piso 12 × 10 ft, 12 × 24 in, caja 16 ft² | 132 ft², 66 piezas, 9 cajas | ✅ |
| Toggle métrico→imperial con 5 × 4 m × 10 cm | 16.40 ft × 13.12 ft × 3.94 in; 2.616 yd³ | ✅ (valor físico idéntico, preferencia guardada) |

## Validación comprobada en navegador
* Vacío → "obligatorio / required"; negativo y cero → "mayor que 0"; 99999 cm de espesor → "Demasiado grande"; cantidad 2.5 → "número entero"; desperdicio 150 % → "Demasiado grande".
* Mientras hay errores no se muestra ningún número (`data-state="invalid"`), `aria-invalid="true"` en los campos y resumen "5 campo(s) con errores".
* Enviar vacío enfoca el primer campo inválido; *Limpiar* restaura valores por defecto.
* Aberturas mayores que el área → aviso visible y 0, nunca negativo.
* Dimensión de pieza incompleta (solo largo) → la otra se marca como obligatoria.

## Errores encontrados y corregidos durante el desarrollo
1. **Rendimiento de sacos** — con densidad redondeada (2136 kg/m³) 1 yd³ daba 46 sacos de 80 lb en vez de 45. Se ancló la constante a "80 lb = 0.60 ft³" exactos.
2. **Campos condicionales visibles** — `display:grid` de `.field-grid` anulaba el atributo `hidden` (Diámetro/Altura aparecían con la losa seleccionada). Se añadió `[hidden]{display:none!important}`.
3. **Selector de sacos/envases** arrancaba en "Sin cálculo" en lugar del tamaño por defecto. Corregido el arranque del select.
4. **Contraste WCAG** — blanco sobre `#0f6fff` daba 4.1:1 (Lighthouse a11y 96). Se cambió el primario a `#0a58ca` → 100.
5. **Títulos/descripciones SEO** fuera de rango (home ES 78 caracteres; privacidad 36 caracteres de descripción). Ajustados; el test de build ahora lo vigila.
6. Falsos positivos de los propios tests (regex `/TODO/i` casaba con "todo" en español; parser numérico del E2E leía dos cifras). Corregidos en los tests, no en el producto.

## Pendiente / no verificado
* **Push al repositorio** — no fue posible: sin credenciales ni conector GitHub en el entorno. El commit está hecho localmente en el clon.
* **Publicación en GitHub Pages** — requiere activar *Settings → Pages → /docs* tras el push.
* **Pruebas en Firefox/Safari/iOS reales** — solo se ejecutó Chromium (headless). El código no usa APIs exóticas (`:has()` se usa solo con fallback visual; `color-mix` solo en decoración), pero conviene una revisión manual en Safari ≥ 16.
* **Lighthouse en producción** — los valores anteriores son contra un servidor local; en GitHub Pages el LCP dependerá de la red.
* **Validación W3C del HTML** — no ejecutada (sin acceso al validador); los tests verifican estructura, IDs únicos, labels y enlaces.
* **Contenido**: FAQs y textos de fórmulas son correctos técnicamente pero revisables por un redactor nativo para cada mercado (ES neutro / EN-US).
* **Monetización**: deliberadamente desactivada; los puntos de inserción existen y están probados solo en modo "deshabilitado" (test confirma que no se inyecta ningún script de terceros).
