/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx,html}",
    "./index.html"
  ],
  theme: {
    extend: {
      colors: {
        dark: '#0a0e27',
        accent: '#00ff88',
      },
      fontFamily: {
        code: ['"JetBrains Mono"', 'monospace'],
        display: ['"Courier Prime"', 'monospace'],
      },
      borderWidth: {
        'brutal': '0.5px',
      },
      borderRadius: {
        'none': '0px',
      }
    },
  },
  plugins: [],
}
