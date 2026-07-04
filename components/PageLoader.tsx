export default function PageLoader() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      backgroundColor: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/sode-primary-logo.png"
        alt="SODE"
        width={110}
        height={77}
        style={{ objectFit: 'contain', animation: 'sode-loader-pulse 1.4s ease-in-out infinite' }}
      />
      <style>{`
        @keyframes sode-loader-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.94); }
        }
      `}</style>
    </div>
  );
}
