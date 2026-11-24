import { notFound, redirect } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";
import { currentAuthMode } from "@/lib/auth/server";
import { safeNext } from "@/lib/login";
import { assertArea } from "@/lib/profile";
import { first, type SearchParams } from "@/lib/query/params";
import { safeOperator } from "@/lib/server/guard";
import { Wordmark } from "@/components/site/SiteChrome";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

/** /login exists only under operator-prod (proxy + this check); elsewhere it is a 404. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  assertArea("login");
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const mode = currentAuthMode();
  if (mode.kind === "none" || mode.kind === "bootstrap") notFound();

  const configured = mode.kind === "github";
  if (configured && (await safeOperator())) redirect(next); // already signed in

  const error = first(sp.error);
  const signedOut = first(sp.signedout) === "1";
  const expired = first(sp.reason) === "expired";
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12" data-testid="login">
      <div className="mb-8"><Wordmark /></div>
      <h1 className="font-serif text-3xl tracking-tight">Sign in</h1>
      <div className="mt-4 space-y-3" aria-live="polite">
        {signedOut && <p className="m-0 rounded-md border border-line bg-sunken px-3 py-2 text-sm" data-testid="login.signed-out">You have signed out.</p>}
        {expired && <p className="m-0 rounded-md border border-line bg-sunken px-3 py-2 text-sm" data-testid="login.expired">Your session expired. Sign in to continue{next !== "/app" ? ` to ${next}` : ""}.</p>}
        {error === "denied" && <p role="alert" className="m-0 rounded-md border border-error bg-[var(--tf-error-tint)] px-3 py-2 text-sm text-error" data-testid="login.denied">This GitHub account is not allowed on this deployment.</p>}
        {error && error !== "denied" && <p role="alert" className="m-0 rounded-md border border-error bg-[var(--tf-error-tint)] px-3 py-2 text-sm text-error" data-testid="login.error">Sign-in did not complete. Try again.</p>}
      </div>
      {configured ? (
        <div className="mt-6">
          {!signedOut && !expired && !error && next !== "/app" && <p className="mb-3 text-sm text-ink-2">Sign in to continue to <span className="mono">{next}</span>.</p>}
          <SignInButton next={next} />
          <p className="mt-4 text-xs text-ink-3">Access is limited to allow-listed GitHub accounts.</p>
        </div>
      ) : (
        <p className="mt-6 rounded-md border border-dashed border-control p-4 text-sm" data-testid="login.not-configured">Sign-in is not configured on this deployment.</p>
      )}
    </main>
  );
}
