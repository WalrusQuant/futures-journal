import { CHECKOUT_URL } from "@/lib/config";

type Props = {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "ghost";
};

export function CheckoutButton({
  children,
  size = "md",
  variant = "primary",
}: Props) {
  const sizeClasses = {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2",
    lg: "text-base px-6 py-3",
  }[size];

  const variantClasses =
    variant === "primary"
      ? "bg-[var(--color-accent)] text-[#04181a] hover:brightness-110 hover:shadow-[0_0_0_4px_rgba(94,224,229,0.18)] border border-[var(--color-accent)] font-semibold"
      : "border border-[var(--color-border-strong)] text-[var(--color-text)] hover:border-[var(--color-accent-dim)] hover:bg-[var(--color-surface)]";

  return (
    <a
      href={CHECKOUT_URL}
      rel="noopener"
      className={`inline-flex items-center gap-2 rounded-md transition-all duration-150 ${sizeClasses} ${variantClasses}`}
    >
      {children}
    </a>
  );
}
