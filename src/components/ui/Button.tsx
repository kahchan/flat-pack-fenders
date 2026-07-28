import { useState, type CSSProperties, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children?: ReactNode;
  label?: string;
  variant?: Variant;
  size?: Size;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const SIZES: Record<Size, CSSProperties> = {
  sm: { padding: '6px 14px', fontSize: '12px', lineHeight: 1 },
  md: { padding: '10px 22px', fontSize: '13px', lineHeight: 1 },
  lg: { padding: '14px 30px', fontSize: '15px', lineHeight: 1 }
};

export function Button({
  children,
  label,
  variant = 'primary',
  size = 'md',
  href,
  onClick,
  disabled = false
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const text = children ?? label;
  const lit = hovered && !disabled;

  const variants: Record<Variant, CSSProperties> = {
    primary: {
      background: lit ? 'var(--color-brand-mid)' : 'var(--color-brand)',
      color: 'var(--color-bg)',
      borderColor: 'transparent',
      boxShadow: lit ? 'var(--shadow-2)' : 'var(--shadow-1)'
    },
    secondary: {
      background: lit ? 'var(--color-bg-alt)' : 'transparent',
      color: 'var(--color-fg)',
      borderColor: lit ? 'var(--color-border-strong)' : 'var(--color-border)',
      boxShadow: 'none'
    },
    ghost: {
      background: lit ? 'var(--color-bg-alt)' : 'transparent',
      color: lit ? 'var(--color-fg)' : 'var(--color-fg-muted)',
      borderColor: 'transparent',
      boxShadow: 'none'
    }
  };

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    textDecoration: 'none',
    border: '1.5px solid transparent',
    borderRadius: 'var(--radius-sm)',
    transition: [
      'background var(--dur-fast) ease',
      'color var(--dur-fast) ease',
      'border-color var(--dur-fast) ease',
      'box-shadow var(--dur-fast) ease',
      'transform var(--dur-instant) ease'
    ].join(', '),
    userSelect: 'none',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    transform: lit ? 'translateY(-1px)' : 'translateY(0)',
    ...SIZES[size],
    ...variants[variant]
  };

  const hover = disabled
    ? {}
    : {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false)
      };

  if (href) {
    return (
      <a href={href} style={style} {...hover}>
        {text}
      </a>
    );
  }

  return (
    <button type="button" style={style} onClick={onClick} disabled={disabled} {...hover}>
      {text}
    </button>
  );
}
