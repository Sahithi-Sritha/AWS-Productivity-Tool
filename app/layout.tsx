import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskPilot - AI Task Prioritizer",
  description: "Prioritize your tasks with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
