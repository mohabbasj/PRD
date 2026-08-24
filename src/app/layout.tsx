import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PRD Editor',
  description: 'Write, save and export Product Requirements Documents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
