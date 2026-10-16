/** Une clases ignorando valores vacíos: cx("a", cond && "b"). */
export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
