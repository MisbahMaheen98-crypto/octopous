/** @type {import('tailwindcss').Config} */
function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        octo: {
          bg: withOpacity('--octo-bg'),
          sidebarBg: withOpacity('--octo-sidebar-bg'),
          surface: withOpacity('--octo-surface'),
          card: withOpacity('--octo-card'),
          panel: withOpacity('--octo-panel'),
          border: withOpacity('--octo-border'),
          borderHover: withOpacity('--octo-border-hover'),
          cyan: withOpacity('--octo-cyan'),
          electric: withOpacity('--octo-electric'),
          violet: withOpacity('--octo-violet'),
          orange: withOpacity('--octo-orange'),
          text: withOpacity('--octo-text'),
          muted: withOpacity('--octo-muted'),
          subtle: withOpacity('--octo-subtle'),
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 20px -3px rgba(0, 240, 255, 0.25)',
        'violet-glow': '0 0 20px -3px rgba(129, 140, 248, 0.25)',
        'purple-glow': '0 0 20px -3px rgba(139, 92, 246, 0.3)',
      }
    },
  },
  plugins: [],
};
