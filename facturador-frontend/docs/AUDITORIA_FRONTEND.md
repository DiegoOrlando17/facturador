# Auditoría integral del frontend — Facturador

Fecha: 2026-10-15. Alcance: sitio público, autenticación, portal del cliente, panel admin (incluido el detalle de cliente) y sistema visual.

Método:
1. Lectura completa del código (37 `.tsx`, `global.css` de 4685 líneas, `theme.css`, prototipos de `design-prototypes/`), contrastando contratos con el backend.
2. Ejecución local (API sin workers + Vite) y capturas con Playwright de todas las rutas en 1440px, 900px y 390px, con un admin y un tenant de prueba (`auditoria@local.test`, tenant `auditoria-kiosco`).
3. Mediciones automáticas: colores, tamaños, desbordes horizontales, contraste WCAG.

Convenciones: rutas relativas a `facturador-frontend/src/` salvo `backend/`. Prioridad **P0** = roto o bloqueante, **P1** = importante, **P2** = pulido. Esfuerzo **S** (horas), **M** (1–2 días), **L** (3+ días).

---

## 1. Veredicto

| Pregunta | Respuesta corta |
|---|---|
| ¿Funciona? | El esqueleto sí, pero hay **flujos rotos en el camino crítico**: Reportes del portal falla con error SQL, el detalle admin del cliente nunca marca integraciones como configuradas y al guardar puede degradar la config de Mercado Pago, todos los CTA de alertas del dashboard llevan a 404, el slug del registro se congela en la primera letra. |
| ¿Es consistente? | No. Conviven 3–4 generaciones de diseño: 154 colores hex distintos (solo ~18% del color usa tokens), 8 azules "primarios", 6 sistemas de badges, 11 variantes de botón, 48 tamaños de fuente, 147 selectores redefinidos. Landing verde/crema, app azul, tres logos diferentes. |
| ¿Es fácil? | Para el operador interno, a medias. Para el comerciante, no: jerga técnica (slug, polling, ms, IANA, OAuth, tier, tenant), enums crudos (`PAST_DUE`, `afip pending`, `PENDING CONFIRMATION`), sin feedback después de las acciones, y en celular el admin y varias tablas se desbordan horizontalmente. |
| ¿Es útil? | El portal hoy es un **visor técnico del pipeline**. No responde las tres preguntas de un comercio: *¿cuánto facturé este mes?*, *¿hay algo que tenga que resolver o aprobar?*, *¿está todo conectado?* |
| ¿Es distintivo y recordable? | No. Nombre genérico ("Facturador"), sin logo propio ni tipografía (Segoe UI cae a Arial en Mac), paleta azul corporativa que se confunde con Mercado Pago y ARCA, sin ilustraciones ni capturas del producto, copy sin tildes y mezclando voseo/tuteo. El único gesto personal (👋, "Diego Orlando" fijo) lo hace parecer una demo. |

Lo rescatable: el titular de la landing ("De Mercado Pago POS a ARCA, con control y trazabilidad") es concreto; la cola operativa del dashboard y el centro de servicios tienen buena intención; el prototipo "Admin operativo + portal guiado" ya marcaba la dirección correcta y se perdió al implementarlo.

---

## 2. Evidencia visual (capturas)

Hallazgos que solo se ven corriendo la app:

- **Reportes del portal**: al abrir la página se muestra al cliente `Invalid prisma.$queryRaw() invocation… syntax error at or near "Object"`. Causa: interpolación de `${bucket}` en `backend/src/services/adminMonitor.service.js:1051-1053`.
- **404**: cualquier URL inexistente muestra la pantalla por defecto de React Router en inglés ("Hey developer 👋").
- **Desborde horizontal** (ancho del documento vs viewport):

  | Ruta | 390px (móvil) | 900px (tablet) |
  |---|---|---|
  | `/admin` | 969 | 1243 |
  | `/admin/tenants` | 867 | 1141 |
  | `/admin/billing` | 528 | — |
  | `/admin/audit` | 514 | — |
  | `/admin/tenants/:slug` | 509 | — |

  En tablet el contenido de Clientes se sale de la tarjeta blanca del shell; la navegación lateral pasa a 2 columnas apretadas con íconos desalineados.
- **Shell en móvil**: los 10+ links del menú, la tarjeta de usuario y "Cerrar sesión" se apilan arriba; el contenido empieza después de ~400px de menú. No hay hamburguesa.
- **Login admin en móvil**: el formulario queda debajo de 3 tarjetas de marketing (~900px de scroll); un círculo decorativo se superpone al texto.
- **Dashboard admin**: "Servicios caídos: 2" con el subtítulo rojo "Sin errores de pagos"; "Clientes bloqueados" con ícono verde; la tabla "Requiere atención" repite 8 filas idénticas ("Fiebre Flow · Pago fallido · Bloquea comprobante") sin fecha ni detalle; "Actividad reciente" muestra el mismo error de Google 7 veces con círculos vacíos; tarjeta de usuario con "Diego Orlando / DO" fijo aunque entre otro admin.
- **Detalle de cliente**: un cliente recién creado figura como "Falta aprobación fiscal" y con MP/ARCA/Drive/Sheets "por configurar", mezclado con "Tenant activo" (inglés).
- **Portal – Inicio**: "Hola, cliente-auditoria" (parte local del email); KPI "Con alertas" en violeta; ninguna guía de primer uso para una cuenta recién creada que todavía no pagó ni configuró nada.
- **Portal – Suscripción**: la píldora `PAST_DUE` se estira a todo el ancho; no hay banner en el resto del portal avisando que la suscripción está pendiente.
- **Portal – Comprobantes**: `<select>` nativo sin estilo; botón "Actualizar" con otro estilo que en las demás páginas.
- **Tres fondos distintos** entre landing (crema), registro/verificación (verde grisáceo) y logins/app (gris azulado). Tutoriales termina con una franja de otro color porque no tiene footer.
- **Botón "Comenzar" del nav**: texto oscuro sobre azul (contraste muy bajo). En la tarjeta post-registro, "Ingresar al portal" queda con texto azul sobre botón azul (casi invisible).

---

## 3. P0 — Roto o bloqueante

### Sitio público y autenticación
| # | Problema | Dónde | Esf. |
|---|---|---|---|
| 1 | El slug autogenerado se congela en la primera letra ("Panadería Luna" → `p`) y el backend lo rechaza. Falta flag `slugTouched` y `minLength=3`. Mismo bug en el alta de clientes del admin. | `pages/RegisterPage.tsx:16`, `pages/AdminSectionPages.tsx:399` | S |
| 2 | Texto invisible/ilegible en botones primarios por especificidad CSS (`.public-form-card > a`, `.marketing-nav a`). | `styles/global.css:4662,4680` | S |
| 3 | Un usuario sin verificar no puede recuperarse: el reenvío solo existe en el estado efímero post-registro; si el link venció, "Volver al registro" falla con "email ya registrado"; el login responde "Credenciales inválidas". | `VerifyEmailPage.tsx`, `ClientLoginPage.tsx`, `backend/.../tenantPortal.service.js:47` | M |
| 4 | El botón "Verificar email en desarrollo" depende de `NODE_ENV !== "production"`, que no se fija en ningún lado: puede aparecer en producción y permite verificar emails ajenos. | `RegisterPage.tsx:15`, `backend/.../publicCommercial.service.js:25,52` | S |
| 5 | Sin ruta 404 ni `errorElement`. | `app/router.tsx` | S |
| 6 | Links legales apuntan a `/login`; el checkbox de términos no enlaza a nada; no existen páginas de Términos/Privacidad ni Botón de arrepentimiento (Res. 424/2020). | `LoginPage.tsx:185-186`, `RegisterPage.tsx:16` | M |
| 7 | Errores del backend llegan crudos al usuario ("slug debe…", "Tenant no encontrado: foo" — además revela qué slugs existen). | `lib/api.ts:56`, `backend/domain/publicRegistration.js`, `backend/routes/portal.routes.js` | S |
| 8 | En móvil la landing oculta "Ingresar": no hay forma de llegar al login. | `global.css:4685` | S |

### Portal del cliente
| # | Problema | Dónde | Esf. |
|---|---|---|---|
| 9 | **Reportes no carga** (error SQL visible al cliente). Revisar también el reporte equivalente del admin. | `backend/src/services/adminMonitor.service.js:1051` | S |
| 10 | Un 401 en Suscripción dispara el listener del **admin** y cierra la sesión admin del navegador; el tenant queda en página rota. | `pages/ClientSubscriptionPage.tsx:8-11`, `lib/api.ts:97` | S |
| 11 | Un 403 por plan se reemplaza por "no tiene permisos", ocultando "Tu plan no incluye…". | `lib/api.ts:52-54` | S |
| 12 | Agenda de MP: vaciar horarios no se guarda (no se envía `RUN_AT_TIMES: []`; el backend conserva el valor viejo). | `pages/ClientIntegrationsPage.tsx:135-142`, `backend/domain/tenantScheduler.js:26-29` | S |
| 13 | Factura manual: el formulario se borra aunque la creación falle. | `pages/ClientInvoicesPage.tsx:20-21` | S |
| 14 | Vencimiento del CAE siempre "Fecha no disponible" (se guarda `dd/mm/yyyy` y se parsea con `new Date`). | `pages/ClientPaymentDetailPage.tsx:109`, `lib/formatters.ts` | S |
| 15 | "Configurada" de MP puede mostrarse sin credenciales (guardar agenda o modalidad pone `enabled: true`). | `backend/routes/portal.routes.js:285`, `backend/.../tenantInvoice.service.js:24` | S/M |
| 16 | "Programar emisión": hora en zona del navegador, sin `min`/`max` (30 días), estado compartido entre filas, sin cancelar, el horario elegido no se ve después. | `pages/ClientInvoicesPage.tsx:28` | M |
| 17 | Manejo de 401 copiado en 9 páginas, con huecos (`changeMode`, `pdf`). Falta un `portalRequest`/`usePortalResource` central con aviso "Tu sesión venció". | todas las `pages/Client*.tsx`, `app/TenantAuthContext.tsx` | M |

### Panel admin
| # | Problema | Dónde | Esf. |
|---|---|---|---|
| 18 | Cinco links del dashboard y uno de Integraciones sin prefijo `/admin` → 404. | `DashboardPage.tsx:268,342,400`, `AdminSectionPages.tsx:869` | S |
| 19 | Los `actionPath` de alertas los arma el backend sin `/admin` → todos los "Ver pago / Revisar" dan 404. | `backend/src/services/adminMonitor.service.js:630-677` | S |
| 20 | Datos inventados como respaldo mientras carga o si falla (`?? 6`, `?? 1`, `?? 124`, `?? 42`): alarmas falsas. | `DashboardPage.tsx:209-212` | S |
| 21 | Filtros de Clientes se leen de la URL una sola vez; "Altas" no filtra altas (filtra bloqueados + problemas). | `AdminSectionPages.tsx:337-338`, `AppShell.tsx:67` | M |
| 22 | Badge de Alertas fijo en `1`; nombre, iniciales y rol del usuario fijos. | `components/layout/AppShell.tsx:93,124-127` | S |

### Detalle de cliente (`TenantDetailPage.tsx`, 3589 líneas)
| # | Problema | Dónde | Esf. |
|---|---|---|---|
| 23 | El checklist nunca marca MP/ARCA/Drive/Sheets como configurados (`hasMeaningfulConfig` rechaza los valores enmascarados que el backend siempre devuelve). El cliente nunca queda "Listo para facturar". Usar `integrations.items[].configured`. | `:381-388`, `:657-673` | S |
| 24 | Probar y después guardar guarda la config vieja: el efecto de reset depende de `isTestingIntegration` y de `profileCuit` (se pierden certificado, `PTO_VTA`, etc. sin aviso). | `:996-1033`, `:1474-1476` | S |
| 25 | Guardar MP desde el admin pasa al cliente a modo programado con 1 lectura/día: `isPlanRealtime` lee un esquema de plan viejo. | `:420-445`, `:295-301`, `:1679-1683` | M |
| 26 | Drive/Sheets no se pueden guardar ni probar tras autorizar Google (`REFRESH_TOKEN`, `SCOPES`, `TOKEN_TYPE` aparecen como campos editables enmascarados). | `:350-353`, `:451-466`, `:1694` | S |
| 27 | Un OPERATOR no puede guardar ni probar ARCA: se llama a `reveal` (solo SUPERADMIN) fuera del `try`, el botón no hace nada. El ojo "Ver valor" se muestra a quien no puede usarlo. | `:1587-1616`, `:1687`, `:1807`, `:3371`, `:3507` | M |
| 28 | No se puede editar nombre, slug ni estado del cliente (el panel existe pero nunca se abre); "Activar cliente" no hace nada. | `:2285-2364`, `:2072-2090` | S |
| 29 | Breadcrumb y redirección post-borrado apuntan a `/tenants` (404). | `:2005`, `:1993` | S |
| 30 | Cinco secciones se renderizan en **todas** las tabs (segunda barra de tabs, checklist repetido, aprobación de onboarding, bloque legacy): el contenido de la tab queda al fondo. | `:2147-2283`, `:2741-2788`, `:2366-2407` | M |

### Sistema visual
| # | Problema | Dónde | Esf. |
|---|---|---|---|
| 31 | Shell roto entre 761 y 1100px y sin menú en móvil: la capa de overrides (línea 3564+) anula los media queries. | `global.css:3418-3446`, `3564-3620`, `915-921` | M |
| 32 | Tablas de 6–7 columnas sin `min-width` ni vista móvil; `overflow: hidden` recorta columnas. | `global.css:3669`, `3744`, `4175` | M |
| 33 | `:focus-visible` solo existe en el portal; en admin el buscador no muestra foco. | `global.css:3749`, `4096` | S |
| 34 | Contraste insuficiente en píldoras success/danger/muted, grupos de nav, encabezados de tabla y KPI naranja (ratios 2.7–4.48). | ver §6 | S |
| 35 | Clases usadas sin CSS que se ven rotas: `section-button--soft` (9 usos), `danger-button`, `login-status-message--success`, `onboarding-score--*`, `status-chip--muted`, `client-profile-status--muted`. | varios | S |

---

## 4. P1 — Importante

### Transversal (fundaciones)
- **Componentes compartidos** (hoy no existen y cada página reinventa): `PageHeader`, `Button`, `StatusBadge`, `Card`/`StatCard`, `DataTable` (tabla real en escritorio, tarjetas en móvil), `Pagination` (ventana alrededor de la página actual), `Tabs` (con `role`/`aria-selected` y sincronizadas a `?tab=`), `Drawer` accesible (dialog, foco, Escape), `ConfirmDialog` (reemplaza `window.confirm`/`prompt`), `Toast`, `EmptyState`/`ErrorState` con Reintentar, `Money`. **L**
- **`lib/statusLabels.ts` único**: label + tono para estado de pago, factura, origen, onboarding, perfil, suscripción, rol, salud, acción de auditoría. Hoy hay `.replace(/_/g," ")` en 8+ lugares y las etapas de pago significan cosas opuestas entre pantallas (`pdf_pending` = "CAE obtenido" en un lado y "Pendiente PDF" en otro). **M**
- **`lib/fiscalLabels.ts`**: tipo de comprobante (1/6/11 → Factura A/B/C), alícuota, tipo de documento, medio de pago, tipo de evento. **S**
- **`lib/formatters.ts`**: `formatCurrency` con centavos y moneda por parámetro (hoy redondea a pesos y asume ARS); `formatFiscalDate`. **S**
- **`useApiResource`**: separar `isLoading` inicial de `isRefreshing` (hoy cada guardado desmonta la página entera y la hace parpadear), `AbortController`/descartar respuestas viejas, debounce en búsquedas. **M**
- **Sesión**: `AuthGate` solo bajo `/admin` y `/login` (hoy bloquea la landing y muestra "API admin" a clientes); no cerrar sesión admin por un error de red (`AuthContext.tsx:91-95`); unificar `authStorage`/`tenantAuthStorage`. **S/M**
- **Permisos**: alinear `lib/adminPermissions.ts` con `backend/domain/permissions.js` (agregar plans, subscriptions, `secrets:reveal`); dejar de chequear `role === "SUPERADMIN"` a mano; exponer permisos del tenant en `/portal/me`. **S**
- **Fechas en zona AR**: Reportes usa `toISOString()` para los inputs; el backend corta días en la zona del servidor. **S/M**
- **Meta y marca técnica**: favicon, `<title>` por ruta, meta description real (hoy dice "Frontend inicial… React, TypeScript y Vite"), `lang="es-AR"`. **S**

### Sitio público y auth
- Recuperar contraseña (admin y cliente). **L**
- Pasar slug y email al login tras registrar/verificar; unificar el nombre del campo ("Identificador para ingresar" vs "Empresa"); quitar `autoComplete="organization"` del slug. **S**
- Llevar el login cliente al nivel del admin (hoy el que ven los clientes es el más pobre) y reescribir el copy del login admin, que le habla a un cliente en vez de al operador. **M**
- Verificación idempotente (StrictMode dispara dos veces; distinguir "ya verificado" de "vencido"). **S**
- Planes: estados carga/error/vacío, validar `?plan=`, precio con "/mes", "+ IVA" y aclaración del cobro en ARS a cotización BNA. **M**
- Formularios: mostrar contraseña, `required`, `autocomplete`, `role="alert"`, quitar el ícono `help` decorativo del input de contraseña. **M**
- Rate limit separado para registro y reenvío. **S**

### Portal
- **Inicio útil**: facturado del mes vs mes anterior; bandeja "Requiere tu acción" (pendientes de confirmar, fallidos, perfil rechazado, suscripción impaga — el backend ya calcula `attentionItems` y los descarta); semáforo de integraciones con último polling; plan actual; checklist "Qué hacer ahora" en la primera visita (estaba en el prototipo). Quitar las queries globales que hace el endpoint. **M/L**
- **Comprobantes**: paginación real (tope oculto de 100), filtros, notas de crédito anidadas bajo su factura, número legible en vez de ID bigint, cancelar anulación, éxito al cambiar modalidad, confirmación en "Emitir ahora", PDF robusto (append al DOM, revocación diferida), validación de documento según tipo, quitar "Consumidor final" como tipo de documento. **M**
- **Pagos**: debounce, filtro de fechas, labels accesibles, etiqueta de estado igual al filtro, aviso de CSV truncado; CSV con `;`, BOM y encabezados en español. **M**
- **Detalle de pago**: labels fiscales, link al comprobante/NC, "Ver PDF" en línea, error traducido con CTA. **M**
- **Suscripción**: estado de carga real (hoy "Cargando..." eterno si no hay suscripción), importes formateados, estado traducido, caso `pending`, qué incluye el plan, comparación y upgrade; funciones bloqueadas como upsell en vez de ocultas. **M**
- **Integraciones**: intervalo en segundos/minutos con presets (no ms), select de zona horaria, horarios con `input type="time"`, mensajes por tarjeta, errores del scheduler traducidos, que un fallo de suscripción no tumbe la página. **M**
- **Onboarding real**: pasos 1 y 2 calculados del perfil y las integraciones (hoy nunca se completan), estados traducidos, éxito al enviar; sacarlo del menú cuando ya está aprobado. **S/M**
- **Datos fiscales**: quitar "Consumidor final" como condición del emisor, validar dígito verificador y máscara del CUIT, vista de lectura para viewer/approver. **S/M**
- **Equipo y cuenta**: invitar usuarios con rol, cambiar contraseña. **L**

### Admin
- KPIs de Facturación con desglose real por etapa (hoy "Pendientes ARCA" y "Pendientes PDF/Drive" muestran el mismo número), filtro de fechas, exportar CSV (el endpoint existe). **M**
- Filtros y página en la URL en todas las listas. **M**
- Mensajes de Admins y Planes fuera del drawer (hoy se pierden al cerrarlo); `Navigate` a `/admin` en vez de `/`. **S**
- PaymentDetail: confirmación en "Emitir ahora" y reprocesos, un solo flag de ocupado, botones con nombres claros ("Reintentar emisión ARCA" en vez de "Auto/ARCA/Postproceso"), datos fiscales que faltan (vto. CAE, tipo, punto de venta). **M**
- Alertas: filtros "Críticas/Advertencias" reales (hoy son spans que parecen tabs), antigüedad, link al cliente, quitar "Ver todas las alertas" dentro de la propia página de alertas. **S**
- "Mi cuenta" accesible desde la tarjeta de usuario (hoy no hay forma de llegar). **S**
- Settings: proteger contra pérdida de datos con JSON inválido; exponer `processing` y `tier` en la UI. **M**

### Detalle de cliente
- Quitar el sync implícito de CUIT ARCA→perfil que **desaprueba** el perfil fiscal sin avisar. **S**
- No pisar formularios de otras tabs al recargar. **M**
- Tab nueva "Onboarding": aprobar solo envíos `pending`, botón de rechazo, mostrar lo que envió el cliente y confirmar que reemplaza integraciones; corregir la leyenda falsa "Al aprobar se pide activar el tenant". **M**
- KPIs del Resumen con datos reales (hoy usan la página actual de Facturación con sus filtros y dicen "últimos 7 días"). **S**
- Separar bloqueante de degradado; Drive/Sheets solo si el plan lo incluye (hoy un cliente TIER_1/2 nunca puede quedar listo). **S**
- Vista de las 4 integraciones con su estado (hoy hay que elegirlas en un select). **M**
- Backend: fusionar secretos enmascarados u omitidos en el PUT de integraciones para que el front no necesite revelar. **M**
- **Refactor del archivo** en `features/tenant-detail/` (layout + 9 tabs + componentes de integración + hooks; ver §8). **L**

---

## 5. P2 — Pulido

- Barrido de copy completo (ver §7).
- Borrar código muerto: `pages/TenantsPage.tsx` (no ruteada; migrar antes la fecha de inicio de MP al alta si se quiere), `components/ui/MetricCard.tsx`, `useApiResource` del portal, ramas `{false ? …}`, ~61 clases CSS sin uso (ilustración del dashboard, `api-health-card*`, shell viejo…), hack `.section-table-card > div:has(> strong){display:none}`, rama `client-nav-link--pending`.
- Ruta duplicada `/admin/payments` → redirigir a `/admin/billing`; marcar Facturación activo en `/admin/payments/:id`.
- Unificar layouts de Account, PaymentDetail, Audit, AdminUsers y Settings en `PageHeader` + `section-*`.
- Separar `AdminSectionPages.tsx` (986 líneas, 4 páginas) en `pages/admin/*`.
- Dashboard: KPIs y actividad clickeables, servicios ordenados por severidad, agrupar alertas repetidas, un solo criterio para "attention" (hoy es "Caído" rojo en un lado y "Revisar" amarillo en otro).
- Auditoría: selects en vez de texto libre (hay que conocer el código interno de la acción), paginación, diff legible.
- Reportes: gráfico de evolución y atajos de período (este mes, mes pasado, 12 meses); facturado de 12 meses vs tope de Monotributo.
- Logos de integraciones en SVG oficiales (hoy `.ico` scrapeados; `redis.ico` pesa 183 KB) y eliminar los logos dibujados con CSS.
- Hover/active y transiciones de 150–200ms (hoy hay 3 `:hover` en todo el CSS y 1 `transition`).
- Modo oscuro (solo después de migrar a tokens).
- Stylelint: prohibir hex fuera de `tokens.css`, `no-duplicate-selectors`.

---

## 6. Sistema visual: números y propuesta

| Métrica | Hoy | Meta |
|---|---|---|
| Colores hex distintos | 154 (415 usos) | ~30 tokens |
| Color tokenizado | ~18% | >95% |
| Azules "primarios" | 8 | 1 + hover/active |
| Tamaños de fuente | 48 | ≤12 |
| Radios | 19 | 4 |
| Valores de espaciado | 40 | ≤10 (grilla de 4px) |
| Breakpoints | 7 | 3 (640/900/1200) |
| Selectores redefinidos | 147 | 0 |
| Sistemas de badge / botón | 6 / 11 variantes | 1 / 1 con variantes |

Contraste que no pasa AA:

| Par | Ratio |
|---|---|
| KPI naranja `#e47713` / `#fff0dd` | 2.70 |
| Grupo de nav `#7a8798` / blanco (0.68rem) | 3.65 |
| Píldora success `#0c8b58` / `#dff8ec` (11.5px) | 3.87 |
| Píldora danger `#d12c2c` / `#ffe4e4` | 4.25 |
| `--muted` sobre `--bg` | 4.45 |
| Píldora muted / encabezado de tabla | 4.47–4.48 |

Los tokens originales de `theme.css` (salidos de los prototipos) pasan AA; lo que falla son los hex agregados después por la capa "Dashboard mockup alignment".

Estructura objetivo de estilos (sin dependencias nuevas, con `@layer`):

```
src/styles/
  index.css        @layer reset, tokens, base, layout, components, pages, utilities
  tokens.css       primitivos + semánticos (luz / [data-theme=dark])
  base.css         reset, tipografía, :focus-visible, reduced-motion
  layout/shell.css un único shell para admin y portal, drawer móvil, topbar
  components/      button, badge, card, table, form, tabs, callout, empty-state
  pages/           marketing, auth, admin-*, portal-*
  legacy.css       global.css actual dentro de @layer legacy, se vacía de a poco
```

Estrategia: congelar (stylelint en advertencia) → línea base de capturas (ya tenemos el script) → tokens con mapeo automático de hex al token más cercano → envolver `global.css` en `@layer legacy` → migrar componente por componente (Button → Badge → Card → DataTable) borrando lo reemplazado → limpiar CSS muerto y medir.

---

## 7. Copy y voz

Problemas sistémicos:
- **Faltan tildes y eñes en casi todo**: Facturacion, Auditoria, Configuracion, sesion, Contrasena, Ultima, Pagina, Razon social, Condicion IVA, suscripcion, credito, Guia, "Si." por "Sí.". Hay pantallas que mezclan ("Lecturas por día" junto a "Ultima actualizacion").
- **Voseo y tuteo mezclados** en la misma frase ("Elegí el nivel… que necesitas"). Recomendación: **voseo rioplatense en todo**, con tilde (Consultá, Completá, Elegí, ¿Confirmás?).
- **Jerga e inglés**: tenant, slug, polling, ms, IANA, OAuth, spreadsheet, tier 3, providers, Provider, realtime, Features JSON, Admins, Workers, Database, Backend, Postproceso, Owner/Admin/Approver/Viewer, "Password".
- **Enums e IDs crudos**: `PAST_DUE`, `ACTIVE`, `SUPERADMIN`, `MERCADOPAGO`, `afip pending`, `PENDING CONFIRMATION`, `AUTOMATIC`, `payment reprocess`, "Pago 1234567890", "Factura <bigint>", "Envío 123".
- **Nombre viejo**: "afip" sigue en estados aunque la marca visible es ARCA.
- **Plurales**: "1 pagos con error", "1 requieren atencion".
- **Navegación del portal confusa**: "Pagos y facturas" y "Comprobantes" compiten; propuesta "Ventas" y "Facturas" con íconos distintos; "Onboarding" → "Puesta en marcha".
- **Contactos inconsistentes**: `contacto@facturador.app` vs `soporte@dorlando.com`.

Entregable: un glosario (`docs/VOZ_Y_GLOSARIO.md`) con términos permitidos/prohibidos y ejemplos, que se aplica en cada fase.

---

## 8. Refactor de `TenantDetailPage.tsx`

3589 líneas, 76 `useState`, 7 efectos, 7 recursos cargados al montar aunque la tab sea Resumen.

```
src/features/tenant-detail/
  TenantDetailPage.tsx        layout, header, tabs sincronizadas con ?tab=
  useTenantDetail.ts          datos + reload (carga inicial vs refresco)
  tenantReadiness.ts          checklist y estado operativo desde integrations.items[].configured + plan
  tabs/                       Summary, Onboarding (nueva), Profile, Subscription,
                              Integrations, Payments, Users, Notes, Advanced
  components/                 ReadinessChecklist, IntegrationEditor/{MercadopagoScheduleFields,
                              AfipCertificateFields, GoogleConnectButton, SecretInput,
                              SavedIntegrationCard, IntegrationTestResult}
  hooks/                      useIntegrationForm, useGoogleOAuthPopup, useRevealSecrets, useFormStatus
  integrationSchema.ts        plantillas, campos, claves ignoradas
```

Mover a `lib/`: `statusLabels`, `paymentStatus`, `integrations`, `plans` (`formatPlanPrice`, `resolvePlanProcessing`), `slug` (hoy triplicado), `files`.

---

## 9. Personalidad y marca

Diagnóstico: el producto resuelve un problema muy concreto y local (ventas POS de Mercado Pago → comprobantes ARCA para comercios argentinos) pero se ve como una plantilla SaaS genérica. No hay nada que un comerciante recuerde después de cerrarlo.

Tres direcciones posibles:

| | A. "Mostrador" | B. "Comprobante" | C. "Automático" |
|---|---|---|---|
| Idea | Comercio de barrio, ticket de papel, sello | Precisión fintech, números, trazabilidad | "Tus ventas se facturan solas" |
| Paleta | Tinta `#1C2321`, verde yerba `#2F6B4F`, papel `#F7F3EA`, terracota `#C8553D` | Marino `#0F1E33`, primario `#1D4F91` (ya es token), verde "emitido" `#12B886` | Índigo `#4338CA`, menta `#34D399`, crema `#FBFAF7`, coral `#E5484D` |
| Tipografía | Bricolage Grotesque + Figtree + JetBrains Mono | IBM Plex Sans + Plex Mono (o Inter) | Plus Jakarta Sans + Inter + Geist Mono |
| Firma | Tarjetas de comprobante con borde dentado, sello "CAE OK" al emitir | Progreso por etapas detectado → emitido → PDF | Pulso en vivo cuando entra una venta |
| A favor | Muy distintiva, la landing ya va hacia el verde | Barata, transmite confianza | Se diferencia de MP/ARCA, ideal para modo oscuro |
| En contra | Necesita ilustración; menos "seria" para estudios contables | Poco memorable, se confunde con MP/ARCA | Puede verse liviana para temas fiscales |

Recomendación: **B como sistema base** (bajo riesgo, conserva tokens) **con la firma y la voz de A** en landing, estados de éxito y comprobantes (ticket + sello "CAE OK"). Números y CUIT/CAE en monoespaciada con cifras tabulares.

Gestos de personalidad concretos, independientes de la dirección:
- Saludo con el nombre comercial, no con el email.
- Momento de éxito al emitir ("Listo, ya está facturado." + sello).
- Inicio del portal como "Qué hacer ahora" (prototipo original) en lugar de KPIs vacíos.
- Estados vacíos con explicación y siguiente paso, no "No hay datos".
- Franja "Funciona con Mercado Pago · ARCA · Google" en la landing, diagrama del flujo y una captura real del producto.
- Precio con equivalente en pesos y "/mes".

Decisión de negocio aparte: "Facturador" no es registrable ni recordable. Si se cambia el nombre, verificar INPI y dominio `.com.ar` antes de diseñar el logo.

---

## 10. Plan de ejecución

Cada fase termina con: build (`npm run build`), capturas Playwright en 3 anchos comparadas con la línea base, y revisión de las rutas afectadas con los usuarios de prueba.

| Fase | Contenido | Hallazgos | Esf. |
|---|---|---|---|
| **0. Red de seguridad** | Script de capturas versionado (`scripts/visual-audit.mjs`), Stylelint en modo advertencia, glosario de voz | — | S |
| **1. Arreglos críticos** | Todos los P0 funcionales sin rediseño: #1–#30 (incluye backend: Reportes, `actionPath`, verificación dev, errores, agenda MP) | §3 | M/L |
| **2. Fundaciones** | `tokens.css` + `base.css` + `@layer legacy`; foco y contraste (#33–#35); componentes compartidos; `statusLabels`/`fiscalLabels`/`formatters`; `portalRequest`/`usePortalResource`; `useApiResource` sin parpadeo; `PublicLayout`, `BrandMark`, 404 | §3 visual, §4 transversal | L |
| **3. Shell y responsive** | Un único shell para admin y portal, drawer móvil, tablas responsive (#31–#32) | §2, §3 | M |
| **4a. Público y auth** | Landing, registro, tutoriales, legales, logins, recuperar contraseña, verificación | §4 | L |
| **4b. Portal** | Inicio "Qué hacer ahora", Comprobantes, Pagos, Detalle, Reportes, Suscripción, Integraciones, Onboarding, Datos fiscales; des-minificar páginas | §4 | L |
| **4c. Admin** | Dashboard, Clientes, Facturación, Alertas, Auditoría, Admins, Planes, PaymentDetail | §4 | L |
| **4d. Detalle de cliente** | Refactor a `features/tenant-detail/` + P1 propios | §4, §8 | L |
| **5. Marca y personalidad** | Dirección elegida, tipografía, logo/favicon, microinteracciones, landing con flujo y capturas | §9 | M/L |
| **6. Cierre** | Borrar código y CSS muerto, Stylelint en modo error, medir contra las metas de §6 | §5 | M |

### Avance

- **2026-10-15 — Fase 0 completa**: `docs/VOZ_Y_GLOSARIO.md`, `scripts/visual-audit.mjs` (`playwright-core` como devDependency), `docs/NOMBRE_PROPUESTA.md`.
- **2026-10-15 — Fase 1 completa** (#1–#30 resueltos; #16 parcial: el horario programado se muestra desde un evento, sin columna propia). Build OK, 101 tests backend OK, 75 capturas sin errores de render. Quedan 11 desbordes horizontales en tablet/móvil, previstos para la fase 3.
- **2026-10-15 — Backend sin credenciales del `.env`** (`7769c4f`): las credenciales de cada cliente salen solo de la base; `.env` original respaldado en `.env.backup-2026-10-15`.
- **2026-10-15 — Fase 2 completa** (`1eece3f`): tokens y capas CSS; `global.css` 100 % tokenizado (166 hex → 0, 51 tamaños → 9, 16 radios → 4, 91 clases muertas fuera); kit de componentes compartidos, etiquetas de estado únicas, marca unificada con favicon, catálogo en `/admin/ui`.
- **2026-10-16 — Marca: se adopta la opción A "Mostrador" completa** (reemplaza la combinación B + firma de A). Paleta tinta / papel / verde yerba / terracota / mostaza; Bricolage Grotesque + Figtree + JetBrains Mono; ticket troquelado y sello en toda la app; menú lateral en tinta. Mock de referencia en el canvas "Mostrador — mock opción A". Tokens reescritos en `src/styles/tokens.css` con contraste AA verificado (el terracota vivo `#C8553D` queda solo como decoración; los botones usan `#B64A33`).
- **2026-10-16 — Marca "Mostrador" aplicada y fase 3 completa**: logo de ticket, títulos en Bricolage, sellos, landing y logins según el mock; shell único admin/portal con menú lateral en tinta y cajón en móvil; 0 desbordes horizontales en las 75 capturas (antes 10).
- **2026-10-16 — Fix backend** (`d17ee1e`): un corte de Redis ya no tira el API.
- **2026-10-16 — Fase 4a completa**: `AuthLayout` compartido (logins, registro, verificación, contraseña; en móvil el formulario va antes que el texto de marca); campos con `TextField`/`PasswordField`, errores con `Callout role="alert"`; registro con estados de planes (carga/error con Reintentar/vacío), `?plan=` validado y plan elegido como ticket con "/mes" y aclaración BNA; **recuperar contraseña** del portal (tabla `PasswordResetToken`, `/recuperar-contrasena` y `/restablecer-contrasena`; admins se la piden a un superadmin); login admin con mensajes legibles; sello del hero sin tapar importes; títulos de pestaña en público y legales con `BRAND`. `login.css` y el CSS `public-form-*` eliminados. Build OK, 115 tests backend OK, 81 capturas sin desbordes (el único error de consola es el 400 esperado de `/verificar-email?token=invalido`).
- **2026-10-16 — Precios sin IVA** (confirmado): no se muestra "+ IVA".
- **2026-10-16 — Fase 4b completa** en cinco commits: Inicio con ticket del mes y "Qué hacer ahora" (`GET /portal/home`); Facturas con chips, sellos, notas de crédito anidadas, paginación y comprobante "Listo, ya está facturado." (`/portal-cliente/comprobantes/:id`, filtro `view` en `/portal/invoices`); Ventas con fechas, chips, detalle y CSV para Excel AR; Reportes con atajos de período y gráfico; Plan y suscripción; Integraciones con agenda legible; Puesta en marcha con pasos calculados; Datos fiscales con vista de lectura y CUIT validado. Backend: fechas de pagos en hora AR, `status` múltiple, validaciones y mensajes en voseo. Build OK, 124 tests backend OK, 81 capturas sin desbordes.
- **Próximo paso: fase 4c** (admin), luego 4d (detalle de cliente). Pendientes: "Equipo y cuenta" del portal (invitar usuarios, cambiar contraseña) sin hacer, a decidir; `GET /portal/dashboard` y las clases CSS viejas del portal quedan para la fase 6; las descripciones de planes en la base no tienen tildes (requiere `plans:sync`, consultar antes).
- Decisiones tomadas: dirección de marca B + firma de A (reemplazada el 2026-10-16 por A completa), nombre nuevo a evaluar (recomendado Troquel), voseo, fixes de backend permitidos, legales genéricos provisorios, `TenantsPage.tsx` eliminado.

El copy (§7) y la accesibilidad se resuelven dentro de cada fase, no como pasada aparte, para no tocar dos veces los mismos archivos.

### Decisiones que necesito antes de las fases 2 y 5
1. **Dirección de marca**: A, B, C o la combinación recomendada (B + firma de A).
2. **Nombre**: se mantiene "Facturador" por ahora o se evalúa uno nuevo.
3. **Voz**: confirmar voseo rioplatense en todo.
4. **Backend**: autorización para tocar el backend donde el bug está ahí (Reportes, `actionPath`, verificación dev, mensajes de error, secretos enmascarados, agenda MP, `enabled` de integraciones).
5. **Legales**: quién provee el texto de Términos, Privacidad y Botón de arrepentimiento (puedo dejar páginas con estructura y marcadores).
6. **`TenantsPage.tsx`**: confirmar que se borra.

### Datos de prueba creados durante la auditoría (base local)
- Admin `auditoria@local.test` (SUPERADMIN).
- Tenant `auditoria-kiosco` con usuario owner `cliente-auditoria@local.test`, plan Inteligente, suscripción `PAST_DUE`.

Se pueden mantener para verificar cada fase o borrar al terminar.
