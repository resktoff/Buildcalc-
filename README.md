# BuildCalc

**Free Construction Calculators | Calculadoras gratuitas de construcción**

BuildCalc is a free collection of online construction calculators designed to estimate material quantities quickly and accurately.

BuildCalc es una colección gratuita de calculadoras online para estimar materiales de construcción de forma rápida y sencilla.

🌐 **Website:** [https://buildcalc-c16f.onrender.com/](https://buildcalc-c16f.onrender.com/)

---

## Calculators | Calculadoras

### Concrete | Hormigón

Calculate concrete volume, required material quantities and estimated bags, including waste allowance.

Calculá el volumen de hormigón y estimá las cantidades necesarias, incluyendo el porcentaje de desperdicio.

- [Concrete Calculator (English)](https://buildcalc-c16f.onrender.com/en/concrete/)
- [Calculadora de hormigón (Español)](https://buildcalc-c16f.onrender.com/es/hormigon/)

### Paint | Pintura

Estimate paint quantities based on surface dimensions and coverage.

Calculá cuánta pintura necesitás según las dimensiones de las superficies y el rendimiento.

- [Paint Calculator (English)](https://buildcalc-c16f.onrender.com/en/paint/)
- [Calculadora de pintura (Español)](https://buildcalc-c16f.onrender.com/es/pintura/)

### Flooring & Tiles | Pisos y revestimientos

Estimate flooring area, material quantities and required boxes.

Calculá superficies y estimá la cantidad de pisos o cajas necesarias.

- [Flooring Calculator (English)](https://buildcalc-c16f.onrender.com/en/flooring/)
- [Calculadora de pisos (Español)](https://buildcalc-c16f.onrender.com/es/pisos/)

---

## Features | Funcionalidades

- Spanish and English interface.
- Metric and imperial measurement systems.
- Material waste allowance.
- Clear calculation breakdowns.
- Local calculation history stored in the browser.
- Responsive interface for desktop and mobile devices.
- Free access, with no account required.

---

## How to use | Cómo usar

1. Select a calculator.
2. Enter the required measurements.
3. Choose the measurement system and options.
4. Review the estimated material quantities.

---

1. Elegí una calculadora.
2. Ingresá las medidas solicitadas.
3. Seleccioná el sistema de unidades y las opciones.
4. Consultá las cantidades estimadas de materiales.

---

## Privacy | Privacidad

- [Privacy Policy (English)](https://buildcalc-c16f.onrender.com/en/privacy/)
- [Política de privacidad (Español)](https://buildcalc-c16f.onrender.com/es/privacidad/)

---

## Technology

BuildCalc is a static website generated with JavaScript, HTML and CSS.

The project includes automated tests for calculation logic, validation, localization, page generation and SEO-related elements.

---

## Development

The project source code is located in `buildcalc/`.

Run the following commands from inside that directory:

```bash
npm run build
```

Generates the static website in `buildcalc/docs/`.

```bash
npm run test:unit
```

Runs unit tests.

```bash
npm run test:build
```

Builds and validates generated pages, SEO metadata, hreflang, sitemap, links and size budgets.

```bash
npm run test:e2e
```

Runs Playwright Chromium end-to-end tests.

```bash
npm run serve
```

Serves the generated website locally.
