import { Hero } from "@/components/Hero";
import { ScreenshotShowcase } from "@/components/ScreenshotShowcase";
import { HowItWorks } from "@/components/HowItWorks";
import { PhilosophyGrid } from "@/components/PhilosophyGrid";
import { WhatYouGet } from "@/components/WhatYouGet";
import { Pricing } from "@/components/Pricing";
import { FAQ } from "@/components/FAQ";

export default function HomePage() {
  return (
    <>
      <Hero />
      <ScreenshotShowcase />
      <HowItWorks />
      <PhilosophyGrid />
      <WhatYouGet />
      <Pricing />
      <FAQ />
    </>
  );
}
