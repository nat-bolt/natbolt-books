const BOTTOM_OFFSETS = {
  nav: 'var(--bottom-nav-offset, 72px)',
  screen: 'var(--screen-safe-bottom, 8px)',
};

const INNER_PADDING_BOTTOM = {
  nav: '16px',
  screen: '16px',
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
      className="fixed left-0 right-0 z-10 mx-auto max-w-lg"
      style={{ bottom }}
    >
      <div
        className={[
          'border-t border-gray-100 bg-white px-4 pt-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]',
          className,
        ].join(' ')}
        style={{ paddingBottom }}
      >
        {children}
      </div>
    </div>
  );
}
