import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Field, fieldClass, fieldId } from "./input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export function Select({
  className,
  containerClassName,
  label,
  error,
  hint,
  id,
  children,
  ...props
}: SelectProps) {
  const selectId = fieldId(id, label);

  return (
    <Field id={selectId} label={label} error={error} hint={hint} className={containerClassName}>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            fieldClass,
            // Native options inherit this background, so dark mode menus stay readable
            "h-9 cursor-pointer appearance-none bg-card py-1 pl-3 pr-9",
            error && "border-destructive focus-visible:ring-destructive/30",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </Field>
  );
}
