import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'todo',
  description: 'A warm, restrained single-user todo app.',
};

// No-flash theme init (Story 3.4). A blocking IIFE that runs before paint, as the first child of
// <body>, stamping data-theme on <html> so the correct palette is live on the very first frame.
// Precedence: a stored 'todo-theme' ('light'/'dark') wins; otherwise honor the OS prefers-color-scheme
// (RD-6). Wrapped in try/catch so a storage/matchMedia exception can never blank the page.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('todo-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
