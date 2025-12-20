import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MonadStudio | Build. Learn. Ship to Monad.",
  description: "The AI-powered IDE for smart contract development on Monad Network. Write, compile, debug, and deploy—all in your browser.",
  keywords: ["Monad", "Smart Contracts", "Blockchain", "IDE", "Web3", "Solidity", "DeFi", "NFT"],
  authors: [{ name: "MonadStudio Team" }],
  openGraph: {
    title: "MonadStudio | Build. Learn. Ship to Monad.",
    description: "The AI-powered IDE for smart contract development on Monad Network.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
