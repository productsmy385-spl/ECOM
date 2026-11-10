import { cn } from "@/lib/utils";
import { Field, fieldClass, fieldId } from "./input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ className, label, error, hint, id, ...props }: TextareaProps) {
  const textareaId = fieldId(id, label);

  return (
    <Field id={textareaId} label={label} error={error} hint={hint}>
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        className={cn(
          fieldClass,
          "min-h-20 resize-y px-3 py-2",
          error && "border-destructive focus-visible:ring-destructive/30",
          className,
        )}
        {...props}
      />
    </Field>
  );
}
