# ADR 0019: Gamification revamp scope

## Status: Accepted

## Context

Gamification today is XP, level, streak, and achievements rendered as three tiny
text stats in the header — mechanically present but emotionally inert ("boring").
The revamp choices were which mechanics to invest in.

## Decision

In scope:

1. **Mascot / companion character** — animated character that reacts to progress and
   celebrates wins; central in kid mode, present but restrained in adult mode.
2. **Celebration & juice** — confetti, streak flames, level-up moments, sound
   effects; make existing XP/streak/level feel alive.
3. **Quests & daily goals** — daily/weekly quests ("review 10 words", "finish 1
   unit") with rewards.
4. **Collectibles & badges** — visually designed badges; kids collect
   stickers/creatures per completed unit.
5. **Visual path progression** — the learning path itself is a progress
   visualization: unit nodes fill, chapters complete, the map colors in.

Explicitly rejected: **reward shop / avatar customization** (XP spend economy) —
adds an economy to balance and content to produce without clear learning value.

## Consequences

- Mascot needs art direction compatible with both dark and bright palettes
  (ADR 0017) — a real design investment.
- Quests need a definition/refresh engine and per-user quest state in the DB.
- Collectibles tie into the path unit model (ADR 0015).
- Sound effects need an audio asset set and a mute preference.
