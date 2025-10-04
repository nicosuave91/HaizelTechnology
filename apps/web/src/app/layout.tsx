import './globals.css';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../lib/theme';
import { QueryProvider } from '../lib/query-provider';

export const metadata = {
  title: 'Haizel Broker Platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
