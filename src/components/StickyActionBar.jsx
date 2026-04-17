const BOTTOM_OFFSETS = {
  nav: 'calc(var(--nav-total-height, 44px) + 8px)',
  screen: 'var(--screen-safe-bottom, 8px)',
};

const INNER_PADDING_BOTTOM = {
  nav: '12px',
  screen: '12px',
};

export default function StickyActionBar({
  children,
  anchor = 'nav',
  className = '',
}) {
  const bottom = BOTTOM_OFFSETS[anchor] || anchor;
  const paddingBottom = INNER_PADDING_BOTTOM[anchor] || INNER_PADDING_BOTTOM.nav;

  return (
    <div
      className="fixed left-0 right-0 z-40 mx-auto max-w-lg"
      style={{ bottom }}
    >
      <div
        className={[
          'bg-white px-4 pt-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]',
          className,
        ].join(' ')}
        style={{ paddingBottom }}
      >
        {children}
      </div>
    </div>
  );
}
