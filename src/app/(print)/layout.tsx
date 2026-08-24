import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'PRD' };

/**
 * The print route has its own root layout so it never loads the app's stylesheet.
 * Tailwind's utility names (`grid`, `block`, `table`) overlap with the words that
 * describe a document, and a print page should not be at their mercy.
 */
export default function PrintRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
