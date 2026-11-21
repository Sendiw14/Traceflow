export const metadata = { title: "Overview" };

export default function AppOverview() {
  return (
    <main>
      <h1 className="text-3xl font-semibold">Overview</h1>
      <p className="mt-2 text-ink-2" data-testid="app.shell.notice">
        Application shell only. No data is loaded and sign-in is not implemented yet.
      </p>
    </main>
  );
}
