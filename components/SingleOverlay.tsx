'use client';

import { useEffect, useState, ReactNode } from 'react';

// Global ref-count for overlays
declare global {
  var singleOverlayCount: number;
}

if (typeof window !== 'undefined') {
  if (!window.singleOverlayCount) {
    window.singleOverlayCount = 0;
  }
}

interface SingleOverlayProps {
  children: ReactNode;
}

export default function SingleOverlay({ children }: SingleOverlayProps) {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    if (window.singleOverlayCount === 0) {
      window.singleOverlayCount++;
      setCanRender(true);
    }

    return () => {
      if (canRender) {
        window.singleOverlayCount--;
      }
    };
  }, [canRender]);

  if (!canRender) return null;

  return <>{children}</>;
}
