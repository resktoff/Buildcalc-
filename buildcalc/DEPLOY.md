# Publicación gratuita de BuildCalc

## Opción A — GitHub Pages desde `/docs` (recomendada, sin Actions)

1. Sube el contenido de este proyecto a `main` (ver "Cómo subir" abajo).
2. En GitHub: **Settings → Pages → Build and deployment**
   * Source: *Deploy from a branch*
   * Branch: `main` · Folder: **`/docs`** → Save.
3. En 1–2 minutos el sitio queda en `https://resktoff.github.io/Buildcalc-/`.
4. Comprueba `https://resktoff.github.io/Buildcalc-/sitemap.xml` y `/robots.txt`.

`site.config.json` ya apunta a `siteUrl: https://resktoff.github.io` y `basePath: /Buildcalc-`.
Si renombras el repositorio o usas dominio propio, cambia esos dos valores, ejecuta `npm run build` y vuelve a hacer commit.

### Dominio propio (opcional)
* Crea `src/public/CNAME` con tu dominio (p. ej. `buildcalc.app`); el build copia todo `src/public/` a la raíz de `docs/`.
* Cambia `basePath` a `""` y `siteUrl` al dominio; rebuild.

## Opción B — Netlify / Cloudflare Pages / Vercel (gratis)
* Build command: `npm run build` · Publish directory: `docs`
* Cambia `basePath` a `""` y `siteUrl` a la URL que te asignen; rebuild.

## Cómo subir el código (no fue posible desde el entorno de desarrollo: sin credenciales)

```bash
# En tu máquina, con acceso al repo:
git clone https://github.com/resktoff/Buildcalc-
cd Buildcalc-
# copia aquí todos los archivos del proyecto (o aplica el bundle/patch entregado)
git add -A
git commit -m "feat: BuildCalc v0.1.0 — concrete, paint & flooring calculators (ES/EN, metric/imperial)"
git push origin main
```

Si prefieres que lo haga el agente: facilita un *fine-grained personal access token* con permiso **Contents: Read & Write** solo para este repositorio (y revócalo después).

## Google Search Console y Analytics

1. **Search Console**: añade la propiedad `https://resktoff.github.io/Buildcalc-/` (tipo *URL prefix*). Copia el código de verificación HTML en `site.config.json → seo.googleSiteVerification`, rebuild, commit. Luego envía `sitemap.xml`.
2. **Analytics (GA4)**: crea la propiedad, copia `G-XXXXXXX` en `analytics.gaMeasurementId`, rebuild, commit. La IP se anonimiza; la política de privacidad ya lo menciona.
3. **AdSense** (cuando el sitio tenga tráfico y contenido suficiente): `ads.enabled: true`, `ads.clientId: "ca-pub-…"`, y los IDs de bloque en `ads.slots`. Crea `src/public/ads.txt` con la línea que te dé AdSense (se copia a la raíz del sitio). Los anuncios aparecen solo en 2 posiciones reservadas (bajo resultados y pie de la home), nunca sobre el formulario.
4. **Afiliados**: `affiliates.enabled: true` y `links: [{ "label": "...", "url": "...", "calc": "concrete" }]`. Se renderizan con `rel="sponsored nofollow"` y aviso de divulgación.
