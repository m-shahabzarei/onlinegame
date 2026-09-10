# Authoritative shop and combat

The web application and renderer remain on Vercel. The independent Node/WebSocket service owns inventory, damage, time windows, currency, and outcomes. Deploy both against protocol **3**; version 2 peers and tickets are incompatible.

## Shop rules

Solo and co-op use the production ten-wave profile. Every cleared wave creates a safe intermission, including the final resupply before the boss. The service's optional `GAMEPLAY_INTERMISSION_MS` sets a 10,000–60,000 ms duration and defaults to 30,000 ms. The wave deadline and `phase6.shopUntil` are the same authoritative time. Test profiles and explicitly injected test waves may use accelerated durations.

Purchases require a connected, ready, living player, an active match, and a current intermission before its deadline. Request IDs are scoped to the player and retained as compact receipts for the bounded session. Duplicate commands never repeat spending. The service returns semantic `shopResult` codes for presentation-layer translation.

## Inventory and combat

Players start owning AR-01 in the primary slot. AR-01, Viper, Breach, and Atlas are primary weapons; PX-9 is secondary. Ownership lasts for the run, up to the five catalog weapons. One primary and one secondary are selected. A primary purchase must explicitly confirm the previously selected weapon through `replaceWeaponId`; it retains the old weapon's ownership and ammunition. Purchases automatically select and equip the new weapon. Owned weapons can be selected again with Equip. Digit1 and Digit2 select the corresponding slots.

Each weapon owns its magazine, reserve, reload completion time, and fire cooldown. The old `PlayerState.weapon` field is a projection referencing the equipped weapon's same ammunition object, not another source of state. Snapshot and reconnect payloads retain the entire inventory and global shot/reload/equip/trigger sequences. Switching is rejected during any reload or global shot cooldown and imposes a 250 ms draw delay.

Every fire command includes a bounded shot sequence and a trigger press sequence. Automatic weapons can repeat a held press; semi-automatic and pump weapons require an intervening release. All modes enforce the weapon's interval. Releasing input, switching, or reconnecting cannot reset shot cooldowns. Only server-generated rays determine impacts; the weapon and upgrades determine range, spread, movement penalty, damage, head multiplier, capacity, and reload/shot timing. Resolved stats are cached for the finite weapon/upgrade combinations.

## Economy and unavailable content

Effective damage earns one Scrap per 20 cumulative damage plus Score and Contribution; a unique zombie kill adds 12 Scrap and 100 Score/Contribution. A unique cleared wave adds `50 + 10 × wave` Scrap and `250 + 50 × wave` Score per player. A first-wave solo clear with eight 65-health walkers yields 182 Scrap; equally shared co-op clears yield 121 each. The PX-9 costs 120; Viper costs 220 and unlocks for wave 2. Prices are therefore attainable during ordinary play.

Ammo refill costs 35 and fills the specified owned weapon's reserve to its capacity. Full reserves reject the purchase. Upgrades apply to live combat immediately. Armor, medkits, grenades, sentries, gates, and objective interactions are unavailable until their authoritative use/deployment/map effects exist; requests are rejected without spending. Intermissions preserve ammunition instead of silently replacing every weapon reserve with the former rifle's reserve.

The final boss uses a real pooled brute entity, existing navigation/telegraphs, 9,000 health, and two damage/speed phases. Its damage and death drive the authoritative boss state and outcome; a final shop precedes it. It currently reuses the brute model and attack pattern. The richer boss-specific ranged/reinforcement attacks and separate mini-boss presentation remain future content.
