import type { Config } from 'tailwindcss';
import tokens from './design-tokens.json';

/**
 * designer_spec §2 의 102개 토큰을 `theme.extend`에 펼쳐 매핑.
 * - 토큰 변경은 design-tokens.json 만 수정하면 반영됨.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: tokens.colors as unknown as Record<string, string>,
      fontFamily: tokens.fontFamily as Record<string, string[]>,
      fontSize: tokens.fontSize as unknown as Record<string, [string, Record<string, string>]>,
      spacing: tokens.spacing as Record<string, string>,
      borderRadius: tokens.borderRadius as Record<string, string>,
      boxShadow: tokens.boxShadow as Record<string, string>,
      lineHeight: tokens.lineHeight as Record<string, string>,
      zIndex: tokens.zIndex as Record<string, string>,
      transitionDuration: tokens.transitionDuration as Record<string, string>,
      transitionTimingFunction: tokens.transitionTimingFunction as Record<string, string>,
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
