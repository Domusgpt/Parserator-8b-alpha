import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Parserator – Freedom-First Data Parsing',
  description:
    'Parserator delivers a two-stage Architect → Extractor pipeline with 95% accuracy, transparent diagnostics, and EMA-aligned portability.',
  keywords: 'parserator, data parsing, ema, architect extractor, ai parsing, freedom to leave, api, sdk',
  openGraph: {
    title: 'Parserator – Freedom-First Data Parsing',
    description: 'Transform messy documents into structured data with the EMA-aligned Architect → Extractor pipeline.',
    url: 'https://parserator.com',
    siteName: 'Parserator',
    images: [
      {
        url: 'https://parserator.com/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Parserator – Freedom-First Data Parsing',
    description: 'Transform any unstructured data into clean, structured JSON with clear diagnostics and EMA guardrails.',
    images: ['https://parserator.com/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}