export default function AuthShell({ hero, children, footer }) {
  return (
    <div
      className="app-shell mx-auto flex w-full max-w-lg flex-col"
      style={{
        background: 'linear-gradient(180deg, #0b0b0b 0%, #23120a 38%, #f06022 100%)',
      }}
    >
      <div
        className="flex-1 overflow-y-auto px-6"
        style={{
          paddingTop: 'calc(var(--safe-top) + 20px)',
          paddingBottom: 'var(--screen-page-bottom)',
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-sm flex-col">
          <div className="pt-2">
            {hero}
          </div>

          <div className="mt-8 rounded-[28px] bg-white px-6 py-6 shadow-[0_28px_64px_rgba(0,0,0,0.22)]">
            {children}
          </div>

          {footer ? (
            <div className="pb-2 pt-5 text-center text-xs leading-relaxed text-white/75">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
