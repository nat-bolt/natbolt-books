const TONE_STYLES = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-green-200 bg-green-50 text-green-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
  neutral: 'border-gray-200 bg-white text-gray-700',
};

export default function InlineNotice({
  title,
  children,
  tone = 'info',
  icon: Icon,
  action,
  compact = false,
  className = '',
}) {
  const toneClass = TONE_STYLES[tone] || TONE_STYLES.info;

  return (
    <div
      className={[
        'rounded-2xl border',
        compact ? 'p-3' : 'p-4',
        toneClass,
        className,
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <Icon className={`${compact ? 'mt-0.5 h-4 w-4' : 'mt-0.5 h-5 w-5'} shrink-0`} />
        ) : null}
        <div className="min-w-0 flex-1">
          {title ? (
            <p className={`${compact ? 'text-sm' : 'text-sm'} font-semibold`}>
              {title}
            </p>
          ) : null}
          {children ? (
            <div className={`${title ? 'mt-1' : ''} text-sm opacity-90`}>
              {children}
            </div>
          ) : null}
          {action ? <div className="mt-2">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
