import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { NativeBootstrap } from '@/components/native-bootstrap';

export const metadata: Metadata = {
  title: 'Nuxia',
  description: 'Nuxia 커머스 × 3세대 레퍼럴',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background text-foreground">
        <Providers>
          <NativeBootstrap />
          {children}
        </Providers>
      </body>
    </html>
  );
}
