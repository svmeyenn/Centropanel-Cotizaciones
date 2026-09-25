import type { Config } from "tailwindcss";

// Paleta corporativa de Centro Panel, la misma del cotizador Access.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        verde: "#1D4E4A",
        "verde-claro": "#2A6B66",
        dorado: "#C9A84C",
        "dorado-osc": "#7A5C10",
        // Mismo tono que dorado-osc, con el nombre que usan las pantallas de
        // finanzas; se conservan los dos para no tocar ninguna de las dos.
        "dorado-oscuro": "#7A5C10",
        crema: "#F8F6F0",
        negro: "#1A1A1A",
        gris: "#666666",
        "gris-suave": "#E5E2DA",
        celeste: "#C9E4F6",
        "celeste-borde": "#3C8DC5",
      },
      fontFamily: {
        sans: ["Calibri", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
