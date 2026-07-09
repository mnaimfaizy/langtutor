import type { Metadata } from "next";

import type { Card } from "@/lib/db";
import { repoGetAllCards } from "@/lib/db/content-actions";

import { StatsClientLazy, type StatsCardItem } from "./stats-loader";

export const metadata: Metadata = { title: "Deck stats — Lang-Tutor" };
export const dynamic = "force-dynamic";

function toStatsCardItem(card: Card): StatsCardItem {
  return {
    dueIso: card.fsrs.due.toISOString(),
    suspended: card.suspended,
  };
}

export default async function DeckStatsPage() {
  const cards = await repoGetAllCards();
  const items = cards.map(toStatsCardItem);

  return <StatsClientLazy initialCards={items} />;
}
