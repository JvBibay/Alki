"use client";

import type { Ctx } from "@/lib/ui";
import Sheet from "./Sheet";
import AlkiCloset from "./AlkiCloset";

export default function ClosetSheet({ ctx }: { ctx: Ctx }) {
  return (
    <Sheet title="Alki’s closet" onClose={ctx.close}>
      <AlkiCloset ctx={ctx} />
    </Sheet>
  );
}
