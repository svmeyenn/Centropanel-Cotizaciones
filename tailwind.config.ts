import type { Config } from "tailwindcss";

// Paleta corporativa de Centro Panel, la misma del cotizador Access.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        verde: "#1D4E4A",
        dorado: "#C9A84C",
        "dorado-osc": "#7A5C10",
        crema: "#F8F6F0",
      },
      fontFamily: {
        sans: ["Calibri", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
