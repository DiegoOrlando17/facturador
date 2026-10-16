# Propuesta de nombre

Fecha: 2026-10-15. Recomendación: **Troquel** (1ª) y **Tilde** (2ª).

"Facturador" además ya está en uso por otro producto ("Facturador Cloud" en la tienda de Tiendanube).

Limitaciones: la disponibilidad de dominios se infirió por DNS (sin sitio = "parece libre"); el INPI Argentina y WIPO no se consultaron. Antes de decidir hay que verificarlos a mano.

## Competencia a evitar
FacturaSimple, Factureo, Emitio, TributoSimple, Yo-Facturo, TusFacturasAPP y una app argentina reciente que integra Mercado Pago con ARCA. Conclusión: evitar las raíces *factur-*, *emit-*, *tribut-*, *simple*.

## Candidatos

| Nombre | Por qué | Estado |
|---|---|---|
| **Troquel** | El borde perforado del ticket y el troquel del remedio: la firma visual hecha nombre. | Preseleccionado |
| **Tilde** | En Argentina "tilde" es el ✓: "tildalo", hecho. | Preseleccionado |
| **Talonario** | El talonario de facturas, ahora digital. | Preseleccionado (muy descriptivo para registrar) |
| **Sellado** | El sello "CAE OK". | Con reparos: "el sellado" es el impuesto provincial de sellos |
| **Posta** | Confianza en voseo. | Con reparos: Axway usa posta.com; registro informal |
| Sellito | — | Descartado: sellito.com.ar, fidelización para comercios |
| Altoque | — | Descartado: dominio en uso, expresión muy usada |
| Cuño | — | Descartado: ñ en dominio, cuno.com.ar en uso |
| Comprobo | — | Descartado: software de verificación de identidad |
| Cuadra | — | Descartado: fintech chilena de cobranza |
| Emitido | — | Descartado: demasiado cerca de Emitio |
| Tique | — | Descartado: término oficial de ARCA |
| Papelito | — | Descartado: papelito.com.ar vende sellos; poco serio |
| Talón | — | Descartado: Talon.One (no verificado) y ambigüedad |
| Listo / Vale | — | Usar como claim, no como nombre |

## Finalistas

### Troquel
- Conflictos: ninguno en facturación ni fintech en Argentina o Latinoamérica. troquel.app es "Troquel AI" (contenido con IA para e-commerce, clase 42): riesgo medio-bajo.
- Dominios: `.com.ar` parece libre; `.com` estacionado, a la venta; `.app` en uso.
- Marca: no aparecieron registros en clases 9/35/36/42; probables en 16/40 (gráficas). Verificar en el INPI.
- "Lo facturo con Troquel." Dos sílabas, se puede dibujar, no sugiere relación con Mercado Pago ni con ARCA.
- Logo: "T" en Plex Sans Semibold con la barra horizontal dentada como borde de ticket, en navy #0F1E33; sello circular "CAE OK" en verde #12B886, apenas inclinado. Ícono de la app: ticket troquelado con la T calada.
- Claim: "Troquel. Listo, ya está facturado."

### Tilde
- Conflictos: tilde.com → Tilde.ai (tecnología lingüística, UE, probables marcas en 9/42); tilde.com.ar con un sitio mínimo. Sin fintechs con ese nombre.
- Dominios: `.com.ar` y `.com` en uso; `.app` no verificable. Habría que usar variantes (usartilde.com.ar) o comprarlo.
- "Lo facturo con Tilde." "¿Ya está? Tildado." Es el que mejor encaja con la voz.
- Logo: ✓ de un solo trazo que sale del borde dentado de un ticket; sello con el ✓ en el centro y el texto circular en Plex Mono.

### Talonario, Sellado, Posta
Ver la tabla: funcionan como palabra, pero tienen problemas de registro o de connotación.

## Próximos pasos antes de decidir
1. INPI ([portaltramites.inpi.gob.ar](https://portaltramites.inpi.gob.ar)): "Troquel" y "Tilde" y sus variantes fonéticas en clases 9, 35, 36 y 42.
2. WIPO Global Brand Database.
3. NIC.ar para el `.com.ar` y precio de troquel.com.
4. Handles de Instagram y X.

Hasta que se decida, el código usa un único componente de marca (`BrandMark`) y una constante con el nombre, para poder cambiarlo en un solo lugar.
