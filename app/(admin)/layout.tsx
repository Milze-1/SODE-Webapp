import AdminSidebar from '@/components/admin/sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sode" style={{ display: 'flex', height: '100dvh', background: 'var(--surface)', overflow: 'hidden' }}>
      <AdminSidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
