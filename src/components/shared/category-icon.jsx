import { Braces, Layers, MessagesSquare, Monitor, Network, Server } from "lucide-react";
import { getCategory } from "@/lib/constants/categories";

const ICONS = { Monitor, Server, Braces, Network, MessagesSquare, Layers };

/** The icon for an interview category. Decorative: the category name is always shown next to it. */
export function CategoryIcon({ category, className }) {
  const Icon = ICONS[getCategory(category).icon];
  return <Icon className={className} aria-hidden="true" />;
}
