// Migra valores sueltos de una hoja CSS heredada a los tokens de src/styles/tokens.css.
//
// - Colores (hex, rgb/rgba): se clasifican por ROL según la propiedad (texto, fondo,
//   borde) y por FAMILIA (neutro, azul, verde, ámbar, rojo, violeta) y se elige el
//   token semántico más cercano en espacio Lab dentro de los candidatos de ese rol.
// - font-size → --text-*, font-weight → --weight-*, border-radius → --radius-*,
//   box-shadow → --shadow-*, padding/margin/gap en px → --space-* (aproximación a la
//   grilla de 4px: los padding redondean hacia arriba y los gaps/márgenes hacia abajo).
//
// Uso:
//   node scripts/tokenize-legacy-css.mjs <archivo.css> --report     solo métricas
//   node scripts/tokenize-legacy-css.mjs <archivo.css> --map        tabla color → token
//   node scripts/tokenize-legacy-css.mjs <archivo.css> --write      aplica los cambios
//
// El resultado es un punto de partida: revisar a mano los casos marcados en --map.

import fs from "node:fs";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("Uso: node scripts/tokenize-legacy-css.mjs <archivo.css> [--report|--map|--write]");
  process.exit(1);
}
const mode = flags.includes("--write") ? "write" : flags.includes("--map") ? "map" : "report";
const css = fs.readFileSync(file, "utf8");

/* ---------- color math ---------- */
function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function rgbToLab([r, g, b]) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function hue([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/* ---------- tokens ---------- */
const tokensCss = fs.readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const raw = Object.fromEntries([...tokensCss.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const resolve = (v) => { let s = v; for (let i = 0; i < 5; i++) s = s.replace(/var\((--[\w-]+)\)/, (_, n) => raw[n]); return s; };
const tokenHex = (name) => resolve(`var(${name})`);

const candidates = {
  text: {
    neutral: ["--color-text", "--color-text-brand", "--color-text-muted", "--color-text-subtle", "--color-text-inverse"],
    blue: ["--color-action"],
    green: ["--color-success-text"],
    amber: ["--color-warning-text"],
    red: ["--color-danger-text"],
    violet: ["--color-info-text"],
  },
  bg: {
    neutral: ["--color-surface", "--color-surface-muted", "--color-surface-sunken", "--color-surface-paper"],
    blue: ["--color-action-soft", "--color-action-soft-hover", "--color-action"],
    green: ["--color-success-bg", "--color-success-solid"],
    amber: ["--color-warning-bg", "--color-surface-paper", "--color-warning-solid"],
    red: ["--color-danger-bg", "--color-danger-action"],
    violet: ["--color-info-bg"],
  },
  border: {
    neutral: ["--color-border", "--color-border-strong"],
    blue: ["--color-border", "--color-border-strong", "--color-action"],
    green: ["--color-success-border"],
    amber: ["--color-warning-border", "--color-warning-solid"],
    red: ["--color-danger-border"],
    violet: ["--color-info-border"],
  },
};

function family(rgb, lab, role) {
  const chroma = Math.hypot(lab[1], lab[2]);
  // Los textos muy oscuros (marino) son texto, no acción.
  if (role === "text" && lab[0] < 30) return "neutral";
  const neutralLimit = role === "text" ? 20 : role === "bg" ? 3.2 : 8;
  if (chroma < neutralLimit) return "neutral";
  const h = hue(rgb);
  if (h < 15 || h >= 345) return "red";
  if (h < 70) return "amber";
  if (h < 175) return "green";
  if (h < 255) return "blue";
  if (h < 300) return "violet";
  return "red";
}

function roleOf(prop) {
  if (/^(color|fill|stroke|caret-color|accent-color|text-decoration-color|outline(-color)?)$/.test(prop)) return "text";
  if (/^border|^box-shadow$/.test(prop)) return "border";
  return "bg";
}

function mapColor(literal, prop) {
  let rgb, alpha = 1;
  if (literal.startsWith("#")) rgb = hexToRgb(literal);
  else {
    const n = literal.match(/[\d.]+/g).map(Number);
    rgb = n.slice(0, 3); alpha = n[3] ?? 1;
  }
  const role = roleOf(prop);
  // Overlays y transparencias del azul de acción.
  if (alpha < 1) {
    const isWhite = rgb.every((c) => c > 245);
    if (isWhite) return { token: "var(--color-surface)", role, fam: "neutral" };
    if (prop.startsWith("background") && rgb[0] < 40 && rgb[1] < 40) return { token: "var(--color-overlay)", role, fam: "neutral" };
    const lab = rgbToLab(rgb);
    const fam = family(rgb, lab, "bg");
    if (fam === "blue") return { token: `color-mix(in srgb, var(--color-action) ${Math.round(alpha * 100)}%, transparent)`, role, fam };
    return null; // sombras: las resuelve mapShadow
  }
  const lab = rgbToLab(rgb);
  const fam = family(rgb, lab, role);
  let list = candidates[role][fam];
  // Texto neutro más claro que --color-text-subtle no pasa AA: se sube a subtle.
  if (role === "text" && fam === "neutral" && lab[0] > rgbToLab(hexToRgb(tokenHex("--color-text-subtle")))[0] && lab[0] < 90) {
    return { token: "var(--color-text-subtle)", role, fam, d: 0 };
  }
  let best = null;
  for (const t of list) {
    const d = dE(lab, rgbToLab(hexToRgb(tokenHex(t))));
    if (!best || d < best.d) best = { token: `var(${t})`, d };
  }
  return { ...best, role, fam };
}

/* ---------- other scales ---------- */
const textScale = [["--text-xs", 0.75], ["--text-sm", 0.875], ["--text-base", 1], ["--text-md", 1.125], ["--text-lg", 1.25], ["--text-xl", 1.5], ["--text-2xl", 1.875], ["--text-3xl", 2.25]];
function mapFontSize(v) {
  if (/^clamp\(/.test(v)) return v; // los títulos fluidos se revisan a mano
  const m = v.match(/^([\d.]+)rem$/) || v.match(/^([\d.]+)px$/);
  if (!m) return v;
  const rem = v.endsWith("px") ? Number(m[1]) / 16 : Number(m[1]);
  if (rem <= 0.8) return "var(--text-xs)"; // nada por debajo de 12px
  let best = textScale[0];
  for (const s of textScale) if (Math.abs(s[1] - rem) < Math.abs(best[1] - rem)) best = s;
  return `var(${best[0]})`;
}
function mapRadius(v) {
  return v.split(/\s+/).map((p) => {
    if (p === "0") return p;
    if (p === "50%") return "var(--radius-full)";
    const m = p.match(/^([\d.]+)px$/);
    if (!m) return p;
    const n = Number(m[1]);
    if (n >= 100) return "var(--radius-full)";
    if (n <= 6) return "var(--radius-sm)";
    if (n <= 10) return "var(--radius-md)";
    return "var(--radius-lg)";
  }).join(" ");
}
function mapShadow(v) {
  if (/^(none|var\()/.test(v)) return v === "var(--shadow)" ? "var(--shadow-lg)" : v;
  const inset = v.match(/^inset 0 0 0 1px (\S+)$/);
  if (inset) return "inset 0 0 0 1px var(--color-border)";
  if (/^0 0 0 [23]px/.test(v)) return "var(--shadow-focus)";
  const nums = v.match(/-?[\d.]+px|0(?=\s)/g) || [];
  const blur = parseFloat(nums[2] || "0");
  if (blur <= 4) return "var(--shadow-sm)";
  if (blur <= 24) return "var(--shadow-md)";
  return "var(--shadow-lg)";
}
const spaceScale = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
function mapSpacing(prop, v) {
  const isPadding = prop.startsWith("padding");
  return v.replace(/(^|\s)(\d+)px(?=\s|$)/g, (all, pre, n) => {
    n = Number(n);
    if (n < 4 || n > 64) return all;
    if (spaceScale.includes(n)) return `${pre}var(--space-${n / 4})`;
    // aproximaciones de ±2px para los valores más repetidos
    const near = { 6: 8, 7: 8, 9: 8, 10: isPadding ? 12 : 8, 14: isPadding ? 16 : 12, 18: isPadding ? 20 : 16, 22: isPadding ? 24 : 20, 26: 24, 28: isPadding ? 32 : 24, 30: 32, 34: 32, 36: isPadding ? 40 : 32 }[n];
    return near ? `${pre}var(--space-${near / 4})` : all;
  });
}
function mapWeight(v, ruleDecls) {
  const n = Number(v);
  if (!n) return v;
  const fs = ruleDecls.find((d) => d.prop === "font-size");
  const small = fs && /--text-xs|0\.[5-7]\d*rem/.test(fs.value);
  if (n >= 800) return small ? "var(--weight-semibold)" : "var(--weight-bold)";
  return { 400: "var(--weight-regular)", 500: "var(--weight-medium)", 600: "var(--weight-semibold)", 700: "var(--weight-bold)" }[n] || v;
}

/* ---------- parse ---------- */
function declarations(text) {
  const out = [];
  const re = /\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const bodyStart = m.index + 1;
    const body = m[1];
    const decls = [];
    let depth = 0, start = 0;
    for (let i = 0; i <= body.length; i++) {
      const c = body[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      if ((c === ";" || i === body.length) && depth === 0) {
        const seg = body.slice(start, i);
        const idx = seg.indexOf(":");
        if (idx > 0 && seg.trim()) {
          const lead = seg.length - seg.trimStart().length;
          const valueRaw = seg.slice(idx + 1);
          const vLead = valueRaw.length - valueRaw.trimStart().length;
          decls.push({
            prop: seg.slice(0, idx).trim().toLowerCase(),
            value: valueRaw.trim(),
            vStart: bodyStart + start + idx + 1 + vLead,
            vEnd: bodyStart + start + idx + 1 + vLead + valueRaw.trim().length,
            start: bodyStart + start + lead,
          });
        }
        start = i + 1;
      }
    }
    out.push(decls);
  }
  return out;
}

const colorRe = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

function metrics(text) {
  const rules = declarations(text);
  let colorValues = 0, colorTokenized = 0;
  const hex = new Set(), sizes = new Set(), radii = new Set(), shadows = new Set(), spaces = new Set(), weights = new Set();
  for (const decls of rules) for (const d of decls) {
    if (d.prop.startsWith("--")) continue;
    const lits = d.value.match(colorRe) || [];
    lits.forEach((l) => l.startsWith("#") && hex.add(l.toLowerCase()));
    const vars = (d.value.match(/var\(--color-[\w-]+\)|var\(--(text|muted|primary|surface|border|bg|success|warning|danger)[\w-]*\)|currentColor|transparent/g) || []).length;
    if (lits.length || /color|background|border|fill|stroke|outline|shadow/.test(d.prop) && vars) {
      colorValues += lits.length + vars;
      colorTokenized += vars;
    }
    if (d.prop === "font-size") sizes.add(d.value);
    if (d.prop === "font-weight") weights.add(d.value);
    if (d.prop === "border-radius") d.value.split(/\s+/).forEach((v) => v !== "0" && radii.add(v));
    if (d.prop === "box-shadow" && d.value !== "none") shadows.add(d.value);
    if (/^(padding|margin|gap|row-gap|column-gap)/.test(d.prop)) (d.value.match(/var\(--space-\d+\)|\d+px/g) || []).forEach((v) => spaces.add(v));
  }
  return {
    distinctHex: hex.size,
    colorValues,
    tokenizedPct: colorValues ? Math.round((colorTokenized / colorValues) * 1000) / 10 : 100,
    fontSizes: sizes.size,
    fontWeights: weights.size,
    radii: radii.size,
    shadows: shadows.size,
    spacingValues: spaces.size,
  };
}

if (mode === "report") {
  console.log(metrics(css));
  process.exit(0);
}

const edits = [];
const table = new Map();
for (const decls of declarations(css)) for (const d of decls) {
  if (d.prop.startsWith("--")) continue;
  let v = d.value;
  if (d.prop === "box-shadow") v = mapShadow(v);
  v = v.replace(colorRe, (lit) => {
    const r = mapColor(lit, d.prop);
    if (!r) return lit;
    const key = `${lit.toLowerCase()} [${r.role}/${r.fam}]`;
    table.set(key, `${r.token}${r.d > 12 ? "   <-- revisar (ΔE " + r.d.toFixed(1) + ")" : ""}`);
    return r.token;
  });
  // degradados que quedaron con un solo token
  v = v.replace(/linear-gradient\(\s*[\d]+deg,\s*(var\(--[\w-]+\))(?:\s+\d+%)?,\s*\1(?:\s+\d+%)?\)/g, "$1");
  if (d.prop === "font-size") v = mapFontSize(v);
  if (d.prop === "font-weight") v = mapWeight(v, decls);
  if (d.prop === "border-radius") v = mapRadius(v);
  if (/^(padding|margin|gap|row-gap|column-gap)(-|$)/.test(d.prop)) v = mapSpacing(d.prop, v);
  if (d.prop === "font-family") v = /mono|consolas|cascadia/i.test(v) ? "var(--font-mono)" : "var(--font-sans)";
  if (v !== d.value) edits.push([d.vStart, d.vEnd, v]);
}

if (mode === "map") {
  console.log([...table].sort().map(([k, v]) => `${k.padEnd(34)} → ${v}`).join("\n"));
  process.exit(0);
}

let out = css;
for (const [s, e, r] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + r + out.slice(e);
fs.writeFileSync(file, out);
console.log("antes:", metrics(css));
console.log("después:", metrics(out));
