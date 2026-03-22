import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pink: {
          DEFAULT: "#FF6B9D",
          light: "#FFE0EB",
          dark: "#E5557F",
        },
        purple: {
          DEFAULT: "#C084FC",
          light: "#EDE4FF",
        },
        mint: {
          DEFAULT: "#6DD3A8",
          light: "#E0FFF0",
        },
        yellow: {
          DEFAULT: "#FFD166",
          light: "#FFF4D6",
        },
        peach: {
          DEFAULT: "#FFB088",
          light: "#FFF0E6",
        },
        cream: {
          DEFAULT: "#FFF8F0",
          dark: "#FFF0E0",
        },
        cute: {
          text: "#2D2B3D",
          light: "#8B87A0",
          muted: "#B0ADC0",
          border: "#F0ECF5",
          card: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Quicksand", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px",
      },
    },
  },
  plugins: [],
};
export default config;
