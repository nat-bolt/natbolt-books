import { useEffect, useRef, useState } from 'react';

export default function useKeyboardAwareModal() {
  const modalRef = useRef(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const updateKeyboardOffset = () => {
      const viewportBottom = viewport.height + viewport.offsetTop;
      const inset = Math.max(0, window.innerHeight - viewportBottom);
      setKeyboardOffset(inset > 120 ? inset : 0);
    };

    updateKeyboardOffset();
    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset);
      viewport.removeEventListener('scroll', updateKeyboardOffset);
    };
  }, []);

  const ensureVisible = (element) => {
    window.requestAnimationFrame(() => {
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  return { keyboardOffset, modalRef, ensureVisible };
}
