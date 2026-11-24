import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";
import { currentAuthMode } from "@/lib/auth/server";
import { loginUrl, safeNext } from "@/lib/login";
import { assertArea } from "@/lib/profile";
import { safeOperator } from "@/lib/server/guard";

// Private segment: never prerender or share-cache (spec §7, §11).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  assertArea("app"); // first: independent of proxy.ts
  const mode = currentAuthMode();
  // operator-prod (github, or misconfigured → fail closed): no operator, no shell. local-dev bootstrap needs no sign-in UI.
  const operator = mode.kind === "github" || mode.kind === "misconfigured" ? await safeOperator() : null;
  if ((mode.kind === "github" || mode.kind === "misconfigured") && !operator) {
    redirect(loginUrl(safeNext((await headers()).get("x-tf-path") ?? "/app")));
  }
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <header className="flex items-center justify-between border-b border-line bg-paper px-4 py-3 md:hidden">
        <Link href="/" className="font-semibold text-ink no-underline">traceflow</Link>
      </header>
      <nav aria-label="Primary" className="flex flex-col border-b border-line bg-paper p-4 md:border-r md:border-b-0">
        <Link href="/" className="hidden font-semibold text-ink no-underline md:block">traceflow</Link>
        <AppNav />
        {mode.kind === "github" && operator && (
          <div className="mt-4 border-t border-line pt-4 text-sm md:mt-auto" data-testid="shell.operator">
            <p className="m-0 mb-2 text-ink-3">Signed in as GitHub ID <span className="mono">{operator.githubId}</span></p>
            <SignOutButton />
          </div>
        )}
      </nav>
      <main id="main" tabIndex={-1} className="min-w-0 p-4 md:p-8">{children}</main>
    </div>
  );
}
