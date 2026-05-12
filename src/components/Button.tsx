import type { ButtonProps } from '@/types'
import { cn } from '@/utils/cn'
import styles from './Button.module.css'

export function Button({
  children,
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(styles.button, styles[variant], className)}
      {...props}
    >
      {children}
    </button>
  )
}
