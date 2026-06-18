import MemberSidebar from '@/components/member/MemberSidebar';

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sode member-shell">
      <MemberSidebar />
      <div className="member-main">{children}</div>
    </div>
  );
}
