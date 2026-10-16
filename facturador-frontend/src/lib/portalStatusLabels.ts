// Re-exporta las etiquetas del portal desde la fuente única (lib/statusLabels.ts)
// para no romper imports existentes. Código nuevo: importar de "@/lib/statusLabels".

export { getPaymentEventLabel, getPaymentStatusLabel } from "@/lib/statusLabels";
