'use client';

import { useEffect, useRef, useState } from 'react';

export interface GeocodeResult { label: string; lat: number; lng: number }

interface LocationAutocompleteProps {
  value: string;
  onChange: (text: string) => void;
  onSelect: (result: GeocodeResult) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

// Address typeahead for the session/settings location fields — debounced
// search against /api/geocode/search (a proxy over OpenStreetMap Nominatim),
// with the picked suggestion's lat/lng handed back via onSelect so callers
// can auto-fill their coordinate fields.
export default function LocationAutocomplete({ value, onChange, onSelect, placeholder, style }: LocationAutocompleteProps) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) { skipNextSearch.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(value.trim())}`);
        const json = await res.json();
        setResults(json.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const pick = (r: GeocodeResult) => {
    skipNextSearch.current = true;
    onChange(r.label);
    onSelect(r);
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
        style={style}
      />
      {open && (results.length > 0 || loading) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 60,
          background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,.14)', maxHeight: 220, overflowY: 'auto',
        }}>
          {loading ? (
            <div style={{ padding: '10px 13px', fontSize: 12.5, color: 'var(--muted)' }}>Searching…</div>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pick(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '9px 13px',
                  fontSize: 12.5, color: 'var(--ink)', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: i < results.length - 1 ? '1px solid var(--line)' : 'none',
                }}
              >
                {r.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
