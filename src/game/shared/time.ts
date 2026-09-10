/** Bounded catch-up: stalls never turn into an unbounded spiral of simulation work. */
export class FixedAccumulator {
  private remainder = 0;
  droppedSeconds = 0;
  constructor(
    readonly step: number,
    readonly maxSteps = 5,
  ) {
    if (!Number.isFinite(step) || step <= 0)
      throw new Error("Invalid timestep");
  }
  advance(delta: number, simulate: () => void) {
    if (!Number.isFinite(delta) || delta <= 0) return 0;
    const bounded = Math.min(delta, this.step * this.maxSteps);
    this.droppedSeconds += delta - bounded;
    this.remainder += bounded;
    let count = 0;
    while (this.remainder + 1e-10 >= this.step && count < this.maxSteps) {
      simulate();
      this.remainder -= this.step;
      count++;
    }
    return count;
  }
  reset() {
    this.remainder = 0;
  }
}
export class RateBudget {
  private tokens: number;
  private last: number;
  constructor(
    readonly rate: number,
    readonly capacity: number,
    now: number,
  ) {
    this.tokens = capacity;
    this.last = now;
  }
  consume(now: number) {
    this.tokens = Math.min(
      this.capacity,
      this.tokens + (Math.max(0, now - this.last) * this.rate) / 1000,
    );
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}
