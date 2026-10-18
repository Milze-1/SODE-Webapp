'use client';

import { useRouter } from 'next/navigation';
import { Icon } from '@/components/sode/icons';
import BottomNav from '@/components/member/bottom-nav';

// Simple read-only member page shell (Help, Privacy): sticky header with a
// back button, scrolling content, bottom nav on mobile.
export default function InfoPage({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="member-page" style={{ position: 'relative', height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="noscroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '13px 16px 12px' }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: 'var(--navy)', fontWeight: 600, fontSize: 13 }}>
            <Icon name="arrowleft" size={18} /> Back
          </button>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{subtitle}</div>}
        </div>
        <div style={{ padding: '14px 16px 100px', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {children}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>{children}</div>
    </div>
  );
}
