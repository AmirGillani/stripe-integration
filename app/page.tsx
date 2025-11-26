import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Stripe Credit-Based System
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            A complete credit-based subscription system using Stripe and MongoDB.
            Learn how to implement subscriptions with credit management.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Link
            href="/pricing"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-white transition-colors hover:bg-blue-700 md:w-[158px]"
          >
            View Pricing
          </Link>
          <Link
            href="/dashboard"
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
          >
            Dashboard
          </Link>
        </div>
        <div className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
          <p className="mb-2">📚 Read the full guide in the project root:</p>
          <p className="text-xs">
            <code>STRIPE_INTEGRATION_GUIDE.md</code>
          </p>
        </div>
      </main>
    </div>
  );
}
