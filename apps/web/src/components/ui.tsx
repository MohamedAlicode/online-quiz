import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'light';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-stage text-white hover:bg-stage-deep',
  secondary: 'bg-white text-ink ring-2 ring-inset ring-line hover:ring-ink',
  quiet: 'text-ink hover:bg-line/60',
  danger: 'text-tomato-ink hover:bg-tomato/10',
  light: 'bg-white text-ink hover:bg-paper',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  busy?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  busy = false,
  className = '',
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const sizing = size === 'lg' ? 'min-h-14 px-7 text-lg' : 'min-h-11 px-4';
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({ label, hint, error, className = '', ...props }: FieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="min-h-12 rounded-xl border-2 border-line bg-white px-3.5 text-ink placeholder:text-ink-soft/70 focus:border-stage focus:outline-none aria-[invalid]:border-tomato"
        {...props}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-bold text-tomato-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Alert({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'info';
}) {
  const styles =
    tone === 'error'
      ? 'border-tomato bg-tomato/10 text-ink'
      : 'border-lagoon bg-lagoon/10 text-ink';
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border-l-4 px-4 py-3 ${styles}`}
    >
      {children}
    </div>
  );
}

/** Logo : les quatre pastilles de réponse, assemblées. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 font-display text-xl font-extrabold ${className}`}
    >
      <span aria-hidden="true" className="grid grid-cols-2 gap-0.5">
        <span className="size-2.5 rounded-[3px] bg-tomato" />
        <span className="size-2.5 rounded-[3px] bg-lagoon" />
        <span className="size-2.5 rounded-[3px] bg-mustard" />
        <span className="size-2.5 rounded-[3px] bg-meadow" />
      </span>
      Quiz Live
    </span>
  );
}
