"use client";

import { useEffect } from "react";
import { CHECKOUT_URL } from "@/lib/config";

export default function BuyPage() {
  useEffect(() => {
    window.location.replace(CHECKOUT_URL);
  }, []);

  return (
    <>
      <head>
        <meta httpEquiv="refresh" content={`0; url=${CHECKOUT_URL}`} />
      </head>
      <div className="mx-auto max-w-xl px-6 py-24 text-center text-[var(--color-fg)]">
        <p className="text-lg">Redirecting to checkout…</p>
        <p className="mt-4 text-sm opacity-70">
          If you aren&apos;t redirected,{" "}
          <a
            href={CHECKOUT_URL}
            className="underline text-[var(--color-accent)]"
          >
            click here
          </a>
          .
        </p>
      </div>
    </>
  );
}
