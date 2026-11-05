import { Braces, Layers, MessagesSquare, Monitor, Network, Server } from "lucide-react";
import { getCategory, type CategoryKey } from "@/lib/constants/categories";

const ICONS = { Monitor, Server, Braces, Network, MessagesSquare, Layers } as const;

/** The icon for an interview category. Decorative: the category name is always shown next to it. */
export function CategoryIcon({ category, className }: { category: CategoryKey; className?: string }) {
  const Icon = ICONS[getCategory(category).icon];
  return <Icon className={className} aria-hidden="true" />;
}
