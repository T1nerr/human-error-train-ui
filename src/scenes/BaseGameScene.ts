import Phaser from 'phaser';
import { TrainSim, SimSnapshot } from '../sim/TrainSim';

export abstract class BaseGameScene extends Phaser.Scene {
  protected sim!: TrainSim;

  protected mode: 'bad' | 'good' = 'good';

  // visuals
  protected trackGfx!: Phaser.GameObjects.Graphics;
  protected overlayGfx!: Phaser.GameObjects.Graphics;

  protected trainASprite!: Phaser.GameObjects.Rectangle;
  protected trainBSprite!: Phaser.GameObjects.Rectangle;

  protected ghostA!: Phaser.GameObjects.Arc;
  protected ghostB!: Phaser.GameObjects.Arc;

  protected headerText!: Phaser.GameObjects.Text;
  protected smallHintText!: Phaser.GameObjects.Text;

  protected endPanel?: Phaser.GameObjects.Container;

  constructor(key: string) {
    super(key);
  }

  public create(): void {
    this.sim = new TrainSim();

    this.trackGfx = this.add.graphics();
    this.overlayGfx = this.add.graphics();

    // trains
    this.trainASprite = this.add.rectangle(0, 0, 108, 18, 0x4aa3ff).setOrigin(0.5);
    this.trainBSprite = this.add.rectangle(0, 0, 18, 108, 0xff6a6a).setOrigin(0.5);

    // ghost markers (prediction ~2 sec)
    this.ghostA = this.add.circle(0, 0, 7).setStrokeStyle(2, 0xffffff).setAlpha(0.65);
    this.ghostB = this.add.circle(0, 0, 7).setStrokeStyle(2, 0xffffff).setAlpha(0.65);

    this.headerText = this.add.text(16, 10, '', {
      fontSize: '16px',
      color: '#eaeaea',
    });

    this.smallHintText = this.add.text(16, 34, '', {
      fontSize: '12px',
      color: '#bdbdbd',
    });

    this.drawStaticWorld();
    this.createUI();
  }

  protected drawStaticWorld(): void {
    const { intersection } = this.sim.snapshot();

    this.trackGfx.clear();

    // tracks
    this.trackGfx.lineStyle(10, 0x2b2b33, 1);
    this.trackGfx.beginPath();
    this.trackGfx.moveTo(90, 300);
    this.trackGfx.lineTo(900, 300);
    this.trackGfx.strokePath();

    this.trackGfx.beginPath();
    this.trackGfx.moveTo(490, 70);
    this.trackGfx.lineTo(490, 560);
    this.trackGfx.strokePath();

    // intersection highlight
    this.trackGfx.fillStyle(0xffffff, 0.85);
    this.trackGfx.fillCircle(intersection.x, intersection.y, 6);
  }

  public update(_: number, deltaMs: number): void {
    const dt = Math.min(0.05, deltaMs / 1000);

    if (!this.sim.ended) {
      this.sim.update(dt, this.mode);
    }

    const snap = this.sim.snapshot();
    this.renderFrame(snap);

    if (snap.ended && !this.endPanel) {
      this.showEndPanel(snap);
    }
  }

  protected renderFrame(snap: SimSnapshot): void {
    // update train positions
    this.trainASprite.setPosition(snap.trainA.x, snap.trainA.y);
    this.trainBSprite.setPosition(snap.trainB.x, snap.trainB.y);

    // ghosts: predict position after ~2 seconds (simple projection along tracks)
    this.updateGhosts();

    // header
    const passengerTimeMin = snap.totalPassengerTime / 60;

    this.headerText.setText(
      `Unfaelle: ${snap.accidents}   Tote Fahrgaeste: ${snap.totalDead}   Gesamt-Fahrzeit: ${passengerTimeMin.toFixed(1)} Passenger-Min`
    );

    this.smallHintText.setText(
      `Zeit: ${snap.t.toFixed(1)}s    Spielende: ${
        snap.endReason === 'completed' ? 'Ziele erreicht' : snap.endReason === 'time' ? 'Zeitlimit' : 'Kollision'
      }`
    );

    this.overlayGfx.clear();
  }

  private updateGhosts(): void {
    const proj = 2;

    // A: horizontal track
    const a = this.sim.trainA;
    const ax = a.x + a.speed * proj;
    const ay = a.y;
    this.ghostA.setPosition(Math.min(900, ax), ay);

    // B: vertical track
    const b = this.sim.trainB;
    const bx = b.x;
    const by = b.y + b.speed * proj;
    this.ghostB.setPosition(bx, Math.min(560, by));
  }

  protected showEndPanel(snap: SimSnapshot): void {
    const w = 640;
    const h = 400;
    const x = 980 / 2;
    const y = 600 / 2;

    const bg = this.add.rectangle(0, 0, w, h, 0x0b0b0e, 0.96).setStrokeStyle(2, 0x555566);

    const title = this.add.text(-w / 2 + 18, -h / 2 + 14, 'Ergebnis', {
      fontSize: '22px',
      color: '#ffffff',
    });

    const aDead = snap.trainA.deadPassengers;
    const bDead = snap.trainB.deadPassengers;

    const passengerTimeMin = snap.totalPassengerTime / 60;

    const body = this.add.text(
      -w / 2 + 18,
      -h / 2 + 60,
      [
        `Endgrund: ${
          snap.endReason === 'collision' ? 'Zusammenstoss (alle sterben)' : snap.endReason === 'time' ? 'Zeitlimit' : 'Beide am Ziel'
        }`,
        '',
        `Tote Fahrgaeste insgesamt: ${snap.totalDead}`,
        `- Zug A: ${aDead} (von ${snap.trainA.alivePassengers + aDead})`,
        `- Zug B: ${bDead} (von ${snap.trainB.alivePassengers + bDead})`,
        '',
        `Unfaelle (Zaehler): ${snap.accidents}`,
        '',
        `Gesamt-Fahrzeit (lebende Fahrgaeste): ${passengerTimeMin.toFixed(1)} Passenger-Min`,
        '',
        'Interpretation:',
        '- Kollision: alle Fahrgaeste sterben.',
        '- Zu starkes Bremsen: nur ein Teil der Fahrgaeste stirbt (je nach Bremsstaerke).',
      ].join('\n'),
      {
        fontSize: '14px',
        color: '#e8e8e8',
        lineSpacing: 6,
        wordWrap: { width: w - 36 },
      }
    );

    const hint = this.add.text(
      -w / 2 + 18,
      h / 2 -40 ,
      'Neustart: Browser Refresh (F5) oder oben die UI-Version wechseln.',
      { fontSize: '12px', color: '#bdbdbd' }
    );

    this.endPanel = this.add.container(x, y, [bg, title, body, hint]);
  }

  protected abstract createUI(): void;
}
