import EmbedTokenLayout from "@/components/layouts/embed-token-layout";

export default function TodoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <EmbedTokenLayout>{children}</EmbedTokenLayout>;
}
