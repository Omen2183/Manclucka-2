import { otherPlayer, pitsOf } from "./engine.ts";
import type { Player } from "./types.ts";

/** Near-side yards, left → right, for the keeper sitting at `south`. */
export function southOrder(south: Player): readonly number[] {
  return pitsOf(south);
}

/** Far-side yards, left → right (reversed so they sit opposite the near row). */
export function northOrder(south: Player): readonly number[] {
  return [...pitsOf(otherPlayer(south))].reverse();
}

/**
 * Keyboard / display row for the player about to sow.
 * The board never rotates — player 0 always sits south in local vs.
 */
export function keyRow(south: Player, turn: Player, gathering: boolean): readonly number[] {
  const acting = gathering ? otherPlayer(turn) : turn;
  return acting === south ? southOrder(south) : northOrder(south);
}
