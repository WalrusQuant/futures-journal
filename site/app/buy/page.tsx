"use client";

import { useEffect } from "react";
import { DOWNLOAD_URL } from "@/lib/config";

export default function BuyPage() {
  useEffect(() => {
    window.location.replace(DOWNLOAD_URL);
  }, []);

  return (
    <>
      <head>
        <meta httpEquiv="refresh" content={`0; url=${DOWNLOAD_URL}`} />
      </head>
      <div className="mx-auto max-w-xl px-6 py-24 text-center text-[var(--color-fg)]">
        <p className="text-lg">It&apos;s free now — redirecting to the download…</p>
        <p className="mt-4 text-sm opacity-70">
          If you aren&apos;t redirected,{" "}
          <a
            href={DOWNLOAD_URL}
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
