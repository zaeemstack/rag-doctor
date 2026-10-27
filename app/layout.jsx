import './globals.css';

export const metadata = {
  title: 'RAG Doctor 🩺 — NVIDIA × Nebius Global AI Hackathon',
  description:
    'Autonomous evaluation, root-cause failure diagnosis, and self-tuning agent for RAG chatbots powered by NVIDIA Nemotron on Nebius Token Factory.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
