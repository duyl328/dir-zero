/** @type {import('tailwindcss').Config} */
function tw(name) {
  return ({ opacityValue }) =>
    opacityValue !== undefined
      ? `rgb(var(--md-${name}) / ${opacityValue})`
      : `rgb(var(--md-${name}))`;
}
function cv(name) {
  return `var(--color-${name})`;
}

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Opacity-capable tokens (use --md-* RGB channel vars)
        primary:                     tw("primary"),
        "on-primary":                tw("on-primary"),
        "primary-container":         tw("primary-container"),
        secondary:                   tw("secondary"),
        "secondary-container":       tw("secondary-container"),
        "on-secondary-container":    tw("on-secondary-container"),
        tertiary:                    tw("tertiary"),
        "tertiary-container":        tw("tertiary-container"),
        "on-tertiary-container":     tw("on-tertiary-container"),
        error:                       tw("error"),
        surface:                     tw("surface"),
        "surface-container":         tw("surface-container"),
        "surface-container-low":     tw("surface-container-low"),
        "surface-container-high":    tw("surface-container-high"),
        "surface-container-highest": tw("surface-container-highest"),
        "surface-container-lowest":  tw("surface-container-lowest"),
        "on-surface":                tw("on-surface"),
        "on-surface-variant":        tw("on-surface-variant"),
        "outline-variant":           tw("outline-variant"),

        // Solid tokens (use --color-* hex vars)
        "primary-dim":               cv("primary-dim"),
        "on-primary-container":      cv("on-primary-container"),
        "inverse-primary":           cv("inverse-primary"),
        "on-secondary":              cv("on-secondary"),
        "on-tertiary":               cv("on-tertiary"),
        "error-container":           cv("error-container"),
        "on-error":                  cv("on-error"),
        "on-error-container":        cv("on-error-container"),
        "surface-bright":            cv("surface-bright"),
        "surface-dim":               cv("surface-dim"),
        "surface-tint":              cv("surface-tint"),
        "surface-variant":           cv("surface-variant"),
        background:                  cv("background"),
        outline:                     cv("outline"),
        "inverse-surface":           cv("inverse-surface"),
        "inverse-on-surface":        cv("inverse-on-surface"),
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.25rem",
        xl: "0.5rem",
        "2xl": "0.75rem",
        full: "9999px",
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
