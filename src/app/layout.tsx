import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getElementsThemeScript } from "@jnpll/elements-ui/themes";
import { ElementsThemeProvider } from "@jnpll/elements-ui/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultThemeSelection = { theme: "alpha", palette: "000" };

export const metadata: Metadata = {
  title: "InGrid",
  description:
    "Build freeform photo collages on a fixed canvas — split, drag-resize with snapping, pan/zoom, and export PNG.",
  icons: { icon: "/grid4-filled.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: getElementsThemeScript({ defaultSelection: defaultThemeSelection, storageKey: "ingrid-design" }) }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ElementsThemeProvider defaultSelection={defaultThemeSelection} storageKey="ingrid-design">{children}</ElementsThemeProvider>
      </body>
    </html>
  );
}
