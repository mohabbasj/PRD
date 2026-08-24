import type { Config } from 'tailwindcss';

/**
 * Colours and sizes here are lifted straight out of PRD_Template_v2.docx so the
 * editor, the print route and the DOCX export all speak the same palette.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1A1A1A',
        subhead: '#333333',
        label: '#444444',
        muted: '#666666',
        hint: '#888888',
        blocknum: '#AAAAAA',
        dotted: '#BBBBBB',
        rule: '#CCCCCC',
        headfill: '#F0F0F0',
        labelfill: '#FAFAFA',
      },
      fontFamily: {
        doc: ['Calibri', 'Carlito', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Template sizes are in half-points; these are the pt equivalents.
        doc: ['9.5pt', '1.45'],
        hint: ['8pt', '1.4'],
        sub: ['8.5pt', '1.4'],
        section: ['10.5pt', '1.3'],
        block: ['13pt', '1.2'],
        title: ['22pt', '1.15'],
      },
    },
  },
  plugins: [],
};

export default config;
