'use client';

import { useEffect, useState } from 'react';

interface CountdownRingProps {
  publishedAt: string;
  expiresAt: string;
  size?: number;
}

export function CountdownRing({ publishedAt, expiresAt, size = 60 }: CountdownRingProps) {
  const [remaining, setRemaining] = useState(0);
  const [percentage, setPercentage] = useState(100);

  useEffect(() => {
    const update = () => {
      const total = new Date(expiresAt).getTime() - new Date(publishedAt).getTime();
      const left = new Date(expiresAt).getTime() - Date.now();
      const pct = Math.max(0, (left / total) * 100);
      setRemaining(Math.max(0, left));
      setPercentage(pct);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [publishedAt, expiresAt]);

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const color = percentage > 50 ? 'var(--navy)' : percentage > 25 ? '#f59e0b' : '#ef4444';
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage / 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span style={{ color, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {remaining <= 0 ? 'Expired' : hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`}
      </span>
    </div>
  );
}
