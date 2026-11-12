# BuildCalc — Auditoría inicial y plan de trabajo

**Fecha:** 2026-11-11 · **Repositorio:** `resktoff/Buildcalc-` (rama `main`)

## 1. Diagnóstico del estado del proyecto

| Aspecto | Hallazgo |
|---|---|
| Historial | 1 commit (`f710663`, "Initial commit") |
| Ramas / tags | Solo `main`, sin tags |
| Archivos | Únicamente `README.md` (22 bytes: `# Buildcalc-` / `Proyecto`) |
| Código fuente previo | **Ninguno.** No existe trabajo funcional que recuperar o conservar más allá del README |
| Acceso | Lectura pública ✅ · Escritura (push) ❌ — no hay credenciales en el entorno ni conector GitHub disponible |

**Conclusión:** no había funcionalidades implementadas. El README original se conservó íntegro (encabezado del nuevo README) y todo lo demás se construyó desde cero.

## 2. Decisiones de arquitectura

* **Sitio estático generado** (Node ≥ 18, sin frameworks ni dependencias de producción). Motivos: publicación gratuita en GitHub Pages, máximo rendimiento, SEO sencillo, cero coste de mantenimiento.
* **Núcleo de cálculo puro** (`src/core`) en SI, independiente del DOM → se prueba en Node y se ejecuta sin cambios en el navegador (ES modules).
* **i18n por diccionarios JSON** con URLs independientes `/es/` y `/en/`; el build inyecta en cada página solo el subconjunto necesario para el cliente.
* **Unidades**: todo se convierte a metros/m²/m³/litros antes de calcular; la UI convierte de vuelta. El toggle convierte los valores ya escritos.
* **Validación en dos capas**: esquema declarativo en la UI (mensajes traducidos) + aserciones defensivas en el núcleo (nunca se muestra un número incorrecto; si el núcleo lanza, la UI muestra estado "inválido").
* **Monetización desacoplada**: GA, verificación de Search Console, AdSense y afiliados viven en `site.config.json` y no emiten ni un byte hasta activarse.
* **Salida en `docs/`** (comprometida en git) para "Deploy from branch → /docs" sin necesidad de GitHub Actions; CI opcional incluida.

## 3. Plan de trabajo ejecutado

| Etapa | Estado |
|---|---|
| 1. Auditoría | ✅ (este documento) |
| 2. Arquitectura | ✅ estructura `src/core · ui · templates · i18n`, config central |
| 3. Desarrollo | ✅ 3 calculadoras, 2 idiomas, 2 sistemas de unidades, desperdicio, fórmulas, validación |
| 4. Pruebas funcionales | ✅ 25 unitarias + 19 E2E en Chromium real |
| 5. Pruebas bilingües y de unidades | ✅ paridad de claves ES/EN, hreflang simétrico, conversión métrico⇄imperial verificada con valores de referencia |
| 6. Optimización SEO | ✅ canonical, hreflang, OG, JSON-LD, sitemap, robots, títulos/descripciones con longitud controlada, Lighthouse SEO 100 |
| 7. Preparación para publicación gratuita | ✅ `docs/` listo, `.nojekyll`, 404, CI, guía `DEPLOY.md` — **pendiente de push por falta de credenciales** |

Ver `TESTING.md` para los resultados reales y los puntos pendientes.
