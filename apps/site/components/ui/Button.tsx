import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import s from "./button.module.css";

export type ButtonProps = {
  /** Primary = the one volt action on a screen; Ink = strong secondary; Secondary = white with hairline; Locked = sand, states why. */
  variant?: "primary" | "ink" | "secondary" | "locked";
  size?: "lg" | "md" | "sm";
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  full?: boolean;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  target?: string;
  rel?: string;
  children: ReactNode;
};

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({ variant = "ink", size = "md", href, onClick, type = "button", disabled, full, icon, iconEnd, className, style, ariaLabel, target, rel, children }: ButtonProps) {
  const cls = cx(s.btn, s[variant], s[size], full && s.full, "pillFocus", className);
  const inner = (
    <>
      {icon ? <span className={s.icon} aria-hidden="true">{icon}</span> : null}
      <span className={s.label}>{children}</span>
      {iconEnd ? <span className={s.icon} aria-hidden="true">{iconEnd}</span> : null}
    </>
  );
  if (href && !disabled) {
    const external = /^(https?:|mailto:|tel:)/.test(href);
    if (external) return <a className={cls} style={style} href={href} onClick={onClick} aria-label={ariaLabel} target={target} rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}>{inner}</a>;
    return <Link className={cls} style={style} href={href} onClick={onClick} aria-label={ariaLabel}>{inner}</Link>;
  }
  return <button className={cls} style={style} type={type} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>{inner}</button>;
}
