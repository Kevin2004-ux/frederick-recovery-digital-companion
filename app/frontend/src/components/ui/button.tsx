import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: "button-primary",
  secondary: "button-secondary",
  ghost: "button-ghost",
  danger: "button-base bg-red-600 text-white hover:bg-red-700",
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  return <button className={cn(variants[variant], className)} type={type} {...props} />;
}
