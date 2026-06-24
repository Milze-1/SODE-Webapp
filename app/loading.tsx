import Image from 'next/image';

export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
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
