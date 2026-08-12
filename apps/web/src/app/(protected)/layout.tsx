import { Nav } from "../../components/nav";

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-shell">
      <Nav />
      {children}
    </div>
  );
}
