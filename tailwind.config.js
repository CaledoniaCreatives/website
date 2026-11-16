/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Semantic tokens mapped to CSS custom properties defined in index.css.
      // Strictly two-tone (Obsidian / Tyrian) + a constant accent — no
      // light/white panel token. --bg-color / --text-color are set per
      // [data-theme] card (discrete stacked layers), not cross-faded by JS.
      colors: {
        surface: "var(--bg-color)",    // current card's background (dark or purple)
        ink: "var(--text-color)",      // current card's text/foreground
        accent: "var(--accent-color)", // Imperial Tyrian, constant — used for accent UI regardless of card
        context: "var(--context-bg)",  // warm-dark neutral visible behind/between stacked cards
        obsidian: "#111111",
        chalk: "#F9F9F7", // kept as a text-only value — never use as a panel/bg color
        tyrian: "#4E1A4E",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      fontSize: {
        // Fluid type scale — clamp() so pin/scrub animations never cause
        // layout jumps across breakpoints.
        "fluid-h1": "clamp(2.5rem, 4vw + 1rem, 7rem)",
        "fluid-h2": "clamp(1.75rem, 2.5vw + 1rem, 4rem)",
        "fluid-body": "clamp(1rem, 0.5vw + 0.85rem, 1.25rem)",
      },
      transitionTimingFunction: {
        engine: "cubic-bezier(0.65, 0.05, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
