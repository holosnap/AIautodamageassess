import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-slate-900">
        AI-assisted vehicle damage reports
      </h1>
      <p className="max-w-xl text-lg text-slate-600">
        Upload photos of a damaged vehicle and get a structured, shareable preliminary
        damage summary in minutes — severity, affected components, and hidden-damage
        flags, powered by Claude.
      </p>
      <Link
        href="/sign-in"
        className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
      >
        Sign in to get started
      </Link>
      <p className="mt-4 max-w-xl text-xs text-slate-400">
        Reports are an AI-generated preliminary summary only and are not a certified
        appraisal.
      </p>
    </div>
  );
}
