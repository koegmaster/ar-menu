// Minimal layout for unauthenticated admin routes (login page).
// No auth check here — that lives only in (protected)/layout.tsx.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
