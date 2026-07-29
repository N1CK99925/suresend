/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ledger: {
          paper: "#EEF0F4",
          card: "#FFFFFF",
          ink: "#1B2436",
          slate: "#3E4A63",
          mute: "#6B7690",
          line: "#D7DCE6",
        },
        seal: {
          brass: "#B98F2C",
          brassDark: "#8C6A1B",
          brassLight: "#E9D8A6",
        },
        route: {
          green: "#3E7A5B",
          amber: "#B9762C",
          red: "#B1483F",
        },
      },
      fontFamily: {
        display: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
        body: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        stamp: "2px",
      },
      boxShadow: {
        stamp: "0 0 0 1.5px rgba(185,143,44,0.55), 0 1px 2px rgba(27,36,54,0.08)",
      },
    },
  },
  plugins: [],
};
