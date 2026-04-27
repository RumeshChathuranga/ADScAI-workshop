import { MenuService } from "@/lib/services/menu";
import { MenuClient } from "./_components/menu-client";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const items = await MenuService.list();
  return <MenuClient items={items} />;
}
