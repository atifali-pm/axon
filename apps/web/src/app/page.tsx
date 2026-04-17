export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-6xl font-bold tracking-tight">Axon</h1>
      <p className="text-neutral-400">AI-powered agentic SaaS platform.</p>
      <div className="flex gap-3">
        <a
          href="/login"
          className="rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-900"
        >
          Log in
        </a>
        <a
          href="/signup"
          className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
        >
          Sign up
        </a>
      </div>
    </main>
  );
}
