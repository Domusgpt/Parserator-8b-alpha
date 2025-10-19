import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Parserator Dashboard - Intelligent Data Parsing API',
  description: 'Manage your Parserator API keys, track usage, and scale your data parsing operations.',
  keywords: 'data parsing, API, AI, machine learning, developer tools',
  openGraph: {
    title: 'Parserator Dashboard',
    description: 'Transform any unstructured data into clean, structured JSON',
    url: 'https://app.parserator.com',
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
    title: 'Parserator Dashboard',
    description: 'Transform any unstructured data into clean, structured JSON',
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
              background: 'rgba(15, 23, 42, 0.92)',
              color: '#f8fafc',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              borderRadius: '14px',
              boxShadow: '0 18px 45px -25px rgba(79,70,229,0.65)',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#7c3aed',
                secondary: '#f8fafc',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#f8fafc',
              },
            },
          }}
        />
      </body>
    </html>
  );
}