import { iconResponse } from "@/lib/icon";

export const dynamic = "force-static";
export function generateStaticParams() { return [{ size: "192" }, { size: "512" }]; }

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  const n = Number(size);
  if (![192, 512].includes(n)) return new Response("Not found", { status: 404 });
  return iconResponse(n);
}
