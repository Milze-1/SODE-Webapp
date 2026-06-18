import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ─── SODE color tokens (map to CSS variables from tokens.css) ───
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border:     "var(--border)",
        ring:       "var(--ring)",
        sode: {
          // surfaces & ink
          bg:           "var(--bg)",
          surface:      "var(--surface)",
          "surface-2":  "var(--surface-2)",
          ink:          "var(--ink)",
          "ink-2":      "var(--ink-2)",
          muted:        "var(--muted)",
          faint:        "var(--faint)",
          line:         "var(--line)",
          "line-2":     "var(--line-2)",
          // navy scale
          navy:         "var(--navy)",
          "navy-700":   "var(--navy-700)",
          "navy-600":   "var(--navy-600)",
          "navy-500":   "var(--navy-500)",
          "navy-ink":   "var(--navy-ink)",
          "navy-tint":  "var(--navy-tint)",
          "navy-tint-2":"var(--navy-tint-2)",
          "on-navy":    "var(--on-navy)",
          // pillars
          spiritual:    "var(--p-spiritual)",
          career:       "var(--p-career)",
          business:     "var(--p-business)",
          character:    "var(--p-character)",
        },
      },

      // ─── SODE border-radius tokens ───
      borderRadius: {
        "sode-xs":   "var(--r-xs)",
        "sode-sm":   "var(--r-sm)",
        "sode-md":   "var(--r-md)",
        "sode-lg":   "var(--r-lg)",
        "sode-xl":   "var(--r-xl)",
        "sode-pill": "var(--r-pill)",
      },

      // ─── SODE shadow tokens ───
      boxShadow: {
        "sode-sm":  "var(--sh-sm)",
        "sode-md":  "var(--sh-md)",
        "sode-lg":  "var(--sh-lg)",
        "sode-pop": "var(--sh-pop)",
      },

      // ─── SODE type-scale tokens ───
      fontSize: {
        "sode-display": ["var(--fs-display)", { lineHeight: "1.1" }],
        "sode-h1":      ["var(--fs-h1)",      { lineHeight: "1.2" }],
        "sode-h2":      ["var(--fs-h2)",      { lineHeight: "1.25" }],
        "sode-h3":      ["var(--fs-h3)",      { lineHeight: "1.3" }],
        "sode-body":    ["var(--fs-body)",    { lineHeight: "1.5" }],
        "sode-sm":      ["var(--fs-sm)",      { lineHeight: "1.4" }],
        "sode-cap":     ["var(--fs-cap)",     { lineHeight: "1.4" }],
        "sode-micro":   ["var(--fs-micro)",   { lineHeight: "1.4" }],
      },

      // ─── SODE font family ───
      fontFamily: {
        sode: ["var(--font)"],
      },

      // ─── Letter-spacing ───
      letterSpacing: {
        "sode-label": "var(--tracking-label)",
      },
    },
  },
  plugins: [],
};

export default config;
