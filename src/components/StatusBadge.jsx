const VARIANT_STYLES = {
  neutral: 'border-gray-200 bg-gray-100 text-gray-700',
  info: 'border-blue-200 bg-blue-100 text-blue-700',
  success: 'border-green-200 bg-green-100 text-green-700',
  warning: 'border-amber-200 bg-amber-100 text-amber-700',
  danger: 'border-red-200 bg-red-100 text-red-700',
  bill: 'border-brand-mid/15 bg-brand-light text-brand-mid',
  estimate: 'border-blue-200 bg-blue-100 text-blue-700',
  paid: 'border-green-200 bg-green-100 text-green-700',
  advance: 'border-amber-200 bg-amber-100 text-amber-700',
  void: 'border-gray-200 bg-gray-100 text-gray-600',
};

const SIZE_STYLES = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

export default function StatusBadge({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) {
  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;
  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.sm;

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-bold uppercase tracking-wide',
        variantClass,
        sizeClass,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
