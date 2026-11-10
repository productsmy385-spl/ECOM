import { cn } from "@/lib/utils";

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export function Checkbox({ className, label, ...props }: CheckboxProps) {
  const box = (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );

  if (!label) return box;

  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
      {box}
      {label}
    </label>
  );
}
