/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        onyx: "#0A0A0A",
        slate: "#1E293B",
        record: "#BE123C",
      },
    },
  },
  plugins: [],
}
