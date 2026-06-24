'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export function NavigationLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const prevPath = useRef(pathname);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide when navigation completes (pathname changed)
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname;
      setVisible(false);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    }
  }, [pathname]);

  // Show on internal link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('/') || href.startsWith('//')) return;
      const targetPath = href.split('?')[0].split('#')[0];
      if (targetPath === prevPath.current) return;
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
      // Safety fallback — never stays visible more than 6s
      timer.current = setTimeout(() => setVisible(false), 6000);
    };
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.90)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'sode-fade .15s ease',
      }}
    >
      <Image
        src="/images/sode-primary-logo.png"
        alt=""
        width={100}
        height={70}
        style={{ animation: 'sode-pulse 1.4s ease-in-out infinite', objectFit: 'contain' }}
        priority
      />
    </div>
  );
}
