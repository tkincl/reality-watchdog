export const metadata = { title: "Reality Hlídač – České Budějovice" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
