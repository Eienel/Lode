import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#f4f1ea",
          raised: "#faf8f3",
          sunken: "#ebe7dd",
        },
        ink: {
          DEFAULT: "#1f1b16",
          soft: "#52493f",
          faint: "#8a7f72",
        },
        line: {
          DEFAULT: "#ddd6c8",
          strong: "#c8bfac",
        },
        accent: {
          DEFAULT: "#9a3412",
          soft: "#b45309",
        },
        good: "#3f6212",
        warn: "#a16207",
        bad: "#9f1239",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(31,27,22,0.04), 0 1px 1px rgba(31,27,22,0.03)",
        lift: "0 4px 16px rgba(31,27,22,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
