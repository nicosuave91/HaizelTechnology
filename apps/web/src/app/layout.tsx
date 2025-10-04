import './globals.css';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../lib/theme';

export const metadata = {
  title: 'Haizel Broker Platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
