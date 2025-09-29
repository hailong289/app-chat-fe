import {heroui} from "@heroui/theme"

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  darkMode: "class",
  plugins: [heroui({
    themes: {
      light: {
        colors: {
          primary: {
            DEFAULT: "#42A59F",
            foreground: "#FFFFFF"
          },
          secondary: {
            DEFAULT: "#51BEA1",
            foreground: "#FFFFFF"
          },
          success: {
            DEFAULT: "#4BB543",
            foreground: "#FFFFFF"
          }
        }
      }
    }
  })],
}

module.exports = config;