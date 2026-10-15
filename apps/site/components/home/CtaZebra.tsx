"use client";
import { InView } from "@/components/site/InView";
import { Zebra } from "@/components/zebra";

/** The final-CTA zebra: starry with sparkles, dances once when it scrolls into view. */
export function CtaZebra({ className }: { className?: string }) {
  return (
    <InView className={className}>
      {(inView) => <Zebra variant="full" mood="starry" members={6} done={6} size={200} animate={{ dance: inView, sparkles: true }} danceKey={inView ? 1 : 0} tailUp label="Zebra with 6 of 6 stripes, starry" />}
    </InView>
  );
}
