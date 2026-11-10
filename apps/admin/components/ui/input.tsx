import { cn } from "@/lib/utils";

// Shared look for every text-like control (Input, Select, Textarea)
export const fieldClass = cn(
  "w-full rounded-lg border border-input bg-transparent text-sm shadow-card transition-colors",
  "placeholder:text-muted-foreground hover:border-muted-foreground/40",
  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function fieldId(id: string | undefined, label: string | undefined) {
  return id || label?.toLowerCase().replace(/\s+/g, "-");
}

interface FieldProps {
  id?: string;
  label?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

// Label + control + error/hint stack used by all form primitives
export function Field({ id, label, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium leading-none text-foreground">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({ className, label, error, hint, id, icon, ...props }: InputProps) {
  const inputId = fieldId(id, label);

  return (
    <Field id={inputId} label={label} error={error} hint={hint}>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(
            fieldClass,
            "flex h-9 px-3 py-1",
            icon && "pl-9",
            error && "border-destructive focus-visible:ring-destructive/30",
            className,
          )}
          {...props}
        />
      </div>
    </Field>
  );
}
