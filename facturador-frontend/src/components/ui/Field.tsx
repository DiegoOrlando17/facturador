import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { cx } from "@/components/ui/cx";

type FieldFrameProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Muestra "(opcional)" junto a la etiqueta en lugar del asterisco de obligatorio. */
  optional?: boolean;
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
};

function fieldIds(id: string, hint?: ReactNode, error?: ReactNode) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return { hintId, errorId, describedBy };
}

function FieldFrame({ id, label, hint, error, required, optional, hideLabel, className, children }: FieldFrameProps) {
  const { hintId, errorId } = fieldIds(id, hint, error);
  return (
    <div className={cx("ui-field", error ? "ui-field--invalid" : null, className)}>
      <label htmlFor={id} className={cx("ui-field__label", hideLabel && "ui-sr-only")}>
        {label}
        {required ? (
          <span className="ui-field__required">
            <span aria-hidden="true">*</span>
            <span className="ui-sr-only"> (obligatorio)</span>
          </span>
        ) : optional ? (
          <span className="ui-field__optional">(opcional)</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="ui-field__error">
          <AppIcon name="alert-circle" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="ui-field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type CommonFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** Mensaje de error: marca el campo como inválido y se asocia con aria-describedby. */
  error?: ReactNode;
  optional?: boolean;
  hideLabel?: boolean;
  /** Clase del contenedor (el `className` va al control). */
  fieldClassName?: string;
};

export type TextFieldProps = CommonFieldProps & {
  /** Texto o ícono fijo antes del valor ("$", "https://"). */
  leading?: ReactNode;
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, hideLabel, fieldClassName, leading, trailing, id, className, required, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const { describedBy } = fieldIds(inputId, hint, error);
  const input = (
    <input
      ref={ref}
      id={inputId}
      className={cx("ui-input", className)}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );
  return (
    <FieldFrame id={inputId} label={label} hint={hint} error={error} required={required} optional={optional} hideLabel={hideLabel} className={fieldClassName}>
      {leading || trailing ? (
        <div className="ui-input-group">
          {leading ? <span className="ui-input-group__addon">{leading}</span> : null}
          {input}
          {trailing ? <span className="ui-input-group__addon ui-input-group__addon--end">{trailing}</span> : null}
        </div>
      ) : (
        input
      )}
    </FieldFrame>
  );
});

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "trailing">;

/** Campo de contraseña con botón Mostrar/Ocultar. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, hint, error, optional, hideLabel, fieldClassName, id, className, required, autoComplete = "current-password", ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const { describedBy } = fieldIds(inputId, hint, error);
  return (
    <FieldFrame id={inputId} label={label} hint={hint} error={error} required={required} optional={optional} hideLabel={hideLabel} className={fieldClassName}>
      <div className="ui-input-group ui-input-group--password">
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          className={cx("ui-input", className)}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <button
          type="button"
          className="ui-input-group__toggle"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-controls={inputId}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          <AppIcon name={visible ? "eye-off" : "eye"} />
        </button>
      </div>
    </FieldFrame>
  );
});

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectFieldProps = CommonFieldProps & {
  options?: SelectOption[];
  /** Opción vacía inicial ("Elegí una opción"). */
  placeholder?: string;
} & SelectHTMLAttributes<HTMLSelectElement>;

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, optional, hideLabel, fieldClassName, options, placeholder, id, className, required, children, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const { describedBy } = fieldIds(selectId, hint, error);
  return (
    <FieldFrame id={selectId} label={label} hint={hint} error={error} required={required} optional={optional} hideLabel={hideLabel} className={fieldClassName}>
      <div className="ui-select">
        <select
          ref={ref}
          id={selectId}
          className={cx("ui-input", "ui-select__control", className)}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled={required}>
              {placeholder}
            </option>
          ) : null}
          {options?.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
          {children}
        </select>
        <AppIcon name="chevron-down" className="ui-select__chevron" />
      </div>
    </FieldFrame>
  );
});

export type TextareaFieldProps = CommonFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, hint, error, optional, hideLabel, fieldClassName, id, className, required, rows = 4, ...rest },
  ref,
) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const { describedBy } = fieldIds(textareaId, hint, error);
  return (
    <FieldFrame id={textareaId} label={label} hint={hint} error={error} required={required} optional={optional} hideLabel={hideLabel} className={fieldClassName}>
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={cx("ui-input", "ui-textarea", className)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </FieldFrame>
  );
});
