import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Parserator · Wide Market Autonomy for Structured Data',
  description:
    'Parserator pairs an Architect planning stage with an Extractor execution engine to deliver 95% accuracy, 70% token savings, and EMA-aligned portability.',
  keywords: 'parserator, architect extractor, EMA, WMA, data parsing, AI, agent tooling',
  openGraph: {
    title: 'Parserator · Agent-first data parsing',
    description: 'Transform unstructured chaos into structured intelligence without sacrificing autonomy.',
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
    title: 'Parserator · Agent-first data parsing',
    description: 'Two-stage Architect → Extractor pipeline with transparent telemetry and EMA guardrails.',
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
      <body className={`${inter.className} h-full bg-slate-950 text-slate-100`}>
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