import { useLayoutEffect } from 'react';

export function useScrollToTop(resetKey?: unknown) {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [resetKey]);
}
