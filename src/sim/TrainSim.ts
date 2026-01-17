export type TrainId = 'A' | 'B';

export type TrainCommand =
  | { type: 'SET_CRUISE'; value01: number } // 0..1
  | { type: 'ACCEL' }
  | { type: 'BRAKE' }
  | { type: 'STOP_SOFT' } // good UI stop
  | { type: 'STOP_TOGGLE_BAD' }; // bad UI ECO toggle

export type TrainSnapshot = {
  id: TrainId;
  x: number;
  y: number;
  speed: number; // px/s
  speedTrend: -1 | 0 | 1;
  distToIntersection: number;
  timeToIntersection: number | null; // null if speed ~ 0
  isFinished: boolean;
  alivePassengers: number;
  deadPassengers: number;
};

export type SimSnapshot = {
  t: number;
  accidents: number;
  totalDead: number;
  totalPassengerTime: number;
  ended: boolean;
  endReason: 'completed' | 'collision' | 'time';
  trainA: TrainSnapshot;
  trainB: TrainSnapshot;
  intersection: { x: number; y: number };
  risk: 'green' | 'yellow' | 'red';
};

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class Train {
  public readonly id: TrainId;

  // track geometry
  private readonly start: { x: number; y: number };
  private readonly end: { x: number; y: number };
  private readonly intersection: { x: number; y: number };
  private readonly trackLen: number;

  // state along track
  private s = 0; // 0..trackLen
  public x = 0;
  public y = 0;

  // kinematics
  public speed = 80;
  private prevSpeed = 80;
  private cruiseSpeed = 80;
  private lastCruiseSpeed = 80;

  // bad-UI ECO toggle
  private ecoToggleStopped = false;
  private ecoToggleCount = 0;

  // passengers
  public readonly passengerCount: number;
  public alivePassengers: number;
  public deadPassengers = 0;

  public isFinished = false;

  constructor(opts: {
    id: TrainId;
    start: { x: number; y: number };
    end: { x: number; y: number };
    intersection: { x: number; y: number };
    passengerCount: number;
  }) {
    this.id = opts.id;
    this.start = opts.start;
    this.end = opts.end;
    this.intersection = opts.intersection;

    const dx = this.end.x - this.start.x;
    const dy = this.end.y - this.start.y;
    this.trackLen = Math.hypot(dx, dy);

    this.passengerCount = opts.passengerCount;
    this.alivePassengers = opts.passengerCount;

    this.setS(0);
  }

  private setS(s: number): void {
    this.s = clamp(s, 0, this.trackLen);
    const t = this.trackLen === 0 ? 0 : this.s / this.trackLen;
    this.x = lerp(this.start.x, this.end.x, t);
    this.y = lerp(this.start.y, this.end.y, t);
    if (this.s >= this.trackLen - 0.0001) this.isFinished = true;
  }

  public command(cmd: TrainCommand, rng01: () => number, onBadEcoAccident?: (info: string) => void): void {
    if (this.isFinished) return;

    if (cmd.type === 'SET_CRUISE') {
      // map 0..1 -> 60..300 px/s
      this.cruiseSpeed = lerp(120, 50, clamp(cmd.value01, 0, 1));
      if (!this.ecoToggleStopped) this.lastCruiseSpeed = this.cruiseSpeed;
      return;
    }

    if (cmd.type === 'ACCEL') {
      this.cruiseSpeed = clamp(this.cruiseSpeed + 4, 60, 300);
      this.lastCruiseSpeed = this.cruiseSpeed;
      return;
    }

    if (cmd.type === 'BRAKE') {
      this.cruiseSpeed = clamp(this.cruiseSpeed - 5, 0, 300);
      if (this.cruiseSpeed > 0) this.lastCruiseSpeed = this.cruiseSpeed;
      return;
    }

    if (cmd.type === 'STOP_SOFT') {
      // good UI: always reliable soft stop
      this.cruiseSpeed = 0;
      return;
    }

    if (cmd.type === 'STOP_TOGGLE_BAD') {
      // bad UI: ECO toggles (first click stops, second resumes)
      this.ecoToggleCount++;
      const wasStopped = this.ecoToggleStopped;
      this.ecoToggleStopped = !this.ecoToggleStopped;

      if (!wasStopped && this.ecoToggleStopped) {
        // going to stop now
        // If speed high => chance of braking accident (speed-dependent); low speed => 0%
        const v = this.speed;
        const threshold = 190; // below this => 0%
        const vmax = 300;

        if (v > threshold) {
          const p = clamp(((v - threshold) / (vmax - threshold)) * 0.85, 0, 0.85);
          if (rng01() < p) {
            // accident: braking shock -> some passengers die
            const killed = this.killFraction(0.35); // up to 35% die
            onBadEcoAccident?.(`ECO braking shock! ${killed} passengers dead.`);
          }
        }

        this.cruiseSpeed = 0;
      } else {
        // resume
        this.cruiseSpeed = Math.max(80, this.lastCruiseSpeed);
      }

      return;
    }
  }

  private killFraction(maxFrac: number): number {
    if (this.alivePassengers <= 0) return 0;
    const frac = clamp(maxFrac, 0, 1);
    const killed = Math.floor(this.alivePassengers * frac);
    this.alivePassengers -= killed;
    this.deadPassengers += killed;
    return killed;
  }

  public update(dt: number, mode: 'bad' | 'good'): void {
    if (this.isFinished) return;

    // dynamics
    const accelRate = 170; // px/s^2
    const brakeRateBad = 420; // harsh
    const brakeRateGood = 180; // gentler

    const target = this.cruiseSpeed;
    const dv = target - this.speed;

    let rate = accelRate;
    if (dv < 0) rate = mode === 'bad' ? brakeRateBad : brakeRateGood;

    const maxStep = rate * dt;
    const step = clamp(dv, -maxStep, maxStep);

    this.prevSpeed = this.speed;
    this.speed = clamp(this.speed + step, 0, 320);

    this.setS(this.s + this.speed * dt);

    // braking casualties (only if braking is strong)
    const decel = Math.max(0, (this.prevSpeed - this.speed) / Math.max(dt, 1e-6));
    const safeDecel = 220;
    const maxDecel = 650;

    if (decel > safeDecel && this.alivePassengers > 0) {
      const x = clamp((decel - safeDecel) / (maxDecel - safeDecel), 0, 1);
      const killFrac = x * 0.18; // up to 18% die by harsh braking
      const killed = Math.floor(this.alivePassengers * killFrac);
      this.alivePassengers -= killed;
      this.deadPassengers += killed;
    }
  }

  public distanceToIntersection(): number {
    const dx = this.intersection.x - this.x;
    const dy = this.intersection.y - this.y;
    return Math.hypot(dx, dy);
  }

  public timeToIntersection(): number | null {
    const d = this.distanceToIntersection();
    if (this.speed < 5) return null;
    return d / this.speed;
  }

  public speedTrend(): -1 | 0 | 1 {
    const diff = this.speed - this.prevSpeed;
    if (Math.abs(diff) < 0.2) return 0;
    return diff > 0 ? 1 : -1;
  }
}

export class TrainSim {
  public readonly intersection = { x: 490, y: 300 };

  public readonly trainA: Train;
  public readonly trainB: Train;

  public t = 0;
  public accidents = 0;
  public ended = false;
  public endReason: 'completed' | 'collision' | 'time' = 'completed';

  public totalPassengerTime = 0; // passenger-seconds

  constructor() {
    // Track A: horizontal
    this.trainA = new Train({
      id: 'A',
      start: { x: 240, y: 300 },
      end: { x: 900, y: 300 },
      intersection: this.intersection,
      passengerCount: 120,
    });

    // Track B: vertical
    this.trainB = new Train({
      id: 'B',
      start: { x: 490, y: 70 },
      end: { x: 490, y: 560 },
      intersection: this.intersection,
      passengerCount: 100,
    });

  }

  public update(dt: number, mode: 'bad' | 'good'): { collision: boolean } {
    if (this.ended) return { collision: false };

    this.t += dt;

    // passenger time accumulates for alive passengers while not finished
    if (!this.trainA.isFinished) this.totalPassengerTime += this.trainA.alivePassengers * dt;
    if (!this.trainB.isFinished) this.totalPassengerTime += this.trainB.alivePassengers * dt;

    this.trainA.update(dt, mode);
    this.trainB.update(dt, mode);

    // collision at intersection
    const ra = 54;
    const aNear = this.trainA.distanceToIntersection() < ra;
    const bNear = this.trainB.distanceToIntersection() < ra;

    if (aNear && bNear && this.trainA.alivePassengers > 0 && this.trainB.alivePassengers > 0) {
      // collision => all passengers die
      this.accidents++;
      this.trainA.deadPassengers += this.trainA.alivePassengers;
      this.trainB.deadPassengers += this.trainB.alivePassengers;
      this.trainA.alivePassengers = 0;
      this.trainB.alivePassengers = 0;

      this.ended = true;
      this.endReason = 'collision';
      return { collision: true };
    }

    // end conditions
    if (this.t > 75) {
      this.ended = true;
      this.endReason = 'time';
    } else if (this.trainA.isFinished && this.trainB.isFinished) {
      this.ended = true;
      this.endReason = 'completed';
    }

    return { collision: false };
  }

  public computeRisk(): 'green' | 'yellow' | 'red' {
    const ta = this.trainA.timeToIntersection();
    const tb = this.trainB.timeToIntersection();

    if (ta === null || tb === null) return 'green';
    const delta = Math.abs(ta - tb);

    if (delta < 1.2) return 'red';
    if (delta < 2.7) return 'yellow';
    return 'green';
  }

  public snapshot(): SimSnapshot {
    const risk = this.computeRisk();

    const mkSnap = (tr: Train): TrainSnapshot => {
      const tti = tr.timeToIntersection();
      return {
        id: tr.id,
        x: tr.x,
        y: tr.y,
        speed: tr.speed,
        speedTrend: tr.speedTrend(),
        distToIntersection: tr.distanceToIntersection(),
        timeToIntersection: tti,
        isFinished: tr.isFinished,
        alivePassengers: tr.alivePassengers,
        deadPassengers: tr.deadPassengers,
      };
    };

    const totalDead = this.trainA.deadPassengers + this.trainB.deadPassengers;

    return {
      t: this.t,
      accidents: this.accidents,
      totalDead,
      totalPassengerTime: this.totalPassengerTime,
      ended: this.ended,
      endReason: this.endReason,
      trainA: mkSnap(this.trainA),
      trainB: mkSnap(this.trainB),
      intersection: { ...this.intersection },
      risk,
    };
  }
}
