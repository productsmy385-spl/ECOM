"use client";

import { chartColors } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type ProgressVariant = "primary" | "success" | "warning" | "danger" | "info" | "gradient";

interface AnimatedProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: ProgressVariant;
  size?: "sm" | "md" | "lg";
  striped?: boolean;
  className?: string;
}

const variantStyles: Record<ProgressVariant, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  gradient: "bg-gradient-to-r from-primary to-highlight",
};

const sizeStyles = { sm: "h-1", md: "h-2", lg: "h-3" };

export function AnimatedProgress({
  value,
  max = 100,
  label,
  showValue = true,
  variant = "primary",
  size = "md",
  striped = false,
  className,
}: AnimatedProgressProps) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => setWidth(percentage), 80);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [percentage]);

  return (
    <div ref={ref} className={cn("space-y-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-xs font-medium">{label}</span>}
          {showValue && (
            <span className="text-xs font-medium text-muted-foreground">{percentage}%</span>
          )}
        </div>
      )}
      <div className={cn("w-full overflow-hidden rounded-full bg-muted", sizeStyles[size])}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-out",
            variantStyles[variant],
            striped &&
              "bg-[length:0.75rem_0.75rem] bg-[linear-gradient(45deg,rgba(255,255,255,.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.2)_50%,rgba(255,255,255,.2)_75%,transparent_75%,transparent)]",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: ProgressVariant;
  showValue?: boolean;
  label?: string;
  className?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 72,
  strokeWidth = 6,
  variant = "primary",
  showValue = true,
  label,
  className,
}: CircularProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  const strokeColors: Record<ProgressVariant, string> = {
    primary: chartColors.primary,
    success: chartColors.success,
    warning: chartColors.warning,
    danger: chartColors.danger,
    info: chartColors.info,
    gradient: "url(#circGrad)",
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => setAnimatedValue(percentage), 80);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [percentage]);

  return (
    <div ref={ref} className={cn("flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="circGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={chartColors.primary} />
              <stop offset="100%" stopColor={chartColors.pink} />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColors[variant]}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold">{percentage}%</span>
          </div>
        )}
      </div>
      {label && <span className="text-2xs font-medium text-muted-foreground">{label}</span>}
    </div>
  );
}
