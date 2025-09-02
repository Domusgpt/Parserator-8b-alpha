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