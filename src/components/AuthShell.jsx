import { useEffect } from 'react';

const AUTH_BACKGROUND = 'linear-gradient(180deg, #0b0b0b 0%, #23120a 38%, #f06022 100%)';

export default function AuthShell({ hero, children, footer }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const prevHtmlBackground = html.style.background;
    const prevBodyBackground = body.style.background;
    const prevRootBackground = root?.style.background || '';

    html.style.background = AUTH_BACKGROUND;
    body.style.background = AUTH_BACKGROUND;
    if (root) {
      root.style.background = AUTH_BACKGROUND;
    }

    return () => {
      html.style.background = prevHtmlBackground;
      body.style.background = prevBodyBackground;
      if (root) {
        root.style.background = prevRootBackground;
      }
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed pointer-events-none"
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 'calc(var(--safe-bottom, 0px) * -1)',
          background: AUTH_BACKGROUND,
          backgroundColor: '#f06022',
        }}
      />

      <div
        className="app-shell relative z-0 mx-auto flex w-full max-w-lg flex-col"
        style={{
          background: AUTH_BACKGROUND,
          backgroundColor: '#f06022',
          minHeight: 'calc(var(--app-height, 100dvh) + var(--safe-bottom, 0px))',
          maxHeight: 'none',
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
    </>
  );
}
