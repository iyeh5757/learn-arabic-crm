import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0D1B2A', mid: '#162236', light: '#1F3352' },
        gold:  { DEFAULT: '#C9A84C', light: '#E8C97A', pale: '#F5E9C8' },
      },
      fontFamily: { sans: ['var(--font-inter)'] },
    },
  },
  plugins: [],
}
export default config
