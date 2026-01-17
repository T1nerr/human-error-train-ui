import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { makeButton } from '../ui/uiHelpers';
import type { Train } from '../sim/TrainSim';

function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

export class BadUIScene extends BaseGameScene {
  private selected: Train | null = null; // last clicked train (NO INDICATOR)

  // tiny UI
  private sliderValue = 55; // 0..100
  private noiseBox!: Phaser.GameObjects.Rectangle;
  private noiseText!: Phaser.GameObjects.Text;
  private noiseLines: string[] = [];

  private rng!: () => number;

  constructor() {
    super('BadUIScene');
    this.mode = 'bad';
  }

  protected createUI(): void {
    // seeded-ish rng for repeatability across runs (still random-ish)
    let seed = Math.floor(Math.random() * 1e9);
    this.rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // BIG useless decoration
    this.add.rectangle(830, 120, 280, 180, 0x222236, 0.6).setStrokeStyle(4, 0x44446a);
    this.add
      .text(830, 120, 'SUPER\nCONTROL\nPANEL', {
        fontSize: '28px',
        color: '#8080ff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.25);

    this.add.rectangle(820, 455, 320, 260, 0x16161d, 0.55).setStrokeStyle(3, 0x3c3c48);

    // NOISE log box (important info drowned)
    this.noiseBox = this.add
      .rectangle(820, 420, 300, 170, 0x0f0f14, 0.95)
      .setStrokeStyle(2, 0x2c2c3a);

    this.noiseText = this.add.text(675, 340, '', {
      fontSize: '11px',
      color: '#cfcfe8',
      wordWrap: { width: 285 },
    });

    // spam noise every ~0.55s
    this.time.addEvent({
      delay: 550,
      loop: true,
      callback: () => {
        const junk = [
          'System nominal',
          'Flow stable',
          'Quantum handshake ok',
          'Packet alignment: green',
          'Thermal vibes: optimal',
          'Cloud sync: humming',
          'Latency feelings: good',
        ];
        this.pushNoise(junk[Math.floor(this.rng() * junk.length)]);
      },
    });

    // clickable trains (selection works, but NOT SHOWN)
    this.trainASprite.setInteractive({ useHandCursor: true });
    this.trainBSprite.setInteractive({ useHandCursor: true });

    this.trainASprite.on('pointerdown', () => {
      this.selected = this.sim.trainA;
      // deliberately no UI feedback
      this.pushNoise('User focus updated.');
    });

    this.trainBSprite.on('pointerdown', () => {
      this.selected = this.sim.trainB;
      // deliberately no UI feedback
      this.pushNoise('Focus switching completed.');
    });

    // tiny controls, close together
    const baseX = 820;
    const baseY = 520;

    makeButton({
      scene: this,
      x: baseX - 90,
      y: baseY + 40,
      w: 70,
      h: 26,
      label: 'SAFE',
      fontSize: 12,
      onClick: () => this.onSafe(),
    });

    makeButton({
      scene: this,
      x: baseX,
      y: baseY + 40,
      w: 70,
      h: 26,
      label: 'ECO',
      fontSize: 12,
      onClick: () => this.onEco(),
    });

    makeButton({
      scene: this,
      x: baseX + 90,
      y: baseY + 40,
      w: 70,
      h: 26,
      label: 'TURBO',
      fontSize: 12,
      onClick: () => this.onTurbo(),
    });

    // slider 0..100 no units (fake slider)
    const sliderX = baseX;
    const sliderY = baseY - 10;

    this.add.text(690, sliderY - 16, 'SPEED', { fontSize: '11px', color: '#d0d0e0' }).setAlpha(0.7);

    const track = this.add
      .rectangle(sliderX, sliderY, 220, 8, 0x2a2a35, 1)
      .setStrokeStyle(1, 0x444456);

    const knob = this.add.circle(sliderX - 110 + (this.sliderValue / 100) * 220, sliderY, 7, 0x9a9ab5, 1);

    track.setInteractive({ useHandCursor: true });
    knob.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(knob);

    const setFromPointer = (px: number) => {
      const left = sliderX - 110;
      const t = clamp((px - left) / 220, 0, 1);
      this.sliderValue = Math.round(t * 100);
      knob.setPosition(left + t * 220, sliderY);
      this.applyCruise();
    };

    track.on('pointerdown', (p: Phaser.Input.Pointer) => setFromPointer(p.x));
    knob.on('drag', (_: unknown, dragX: number) => setFromPointer(dragX));

    // pick default selection silently
    this.selected = this.sim.trainA;

    // initial cruise set
    this.applyCruise();

    this.smallHintText.setText('Bad UI: Click a train (no indicator). Use SAFE/ECO/TURBO + slider 0-100.');
  }

  private pushNoise(line: string): void {
    this.noiseLines.push(line);
    if (this.noiseLines.length > 11) this.noiseLines.shift();
    this.noiseText.setText(this.noiseLines.join('\n'));
  }

  private getTarget(): Train {
    return this.selected ?? this.sim.trainA;
  }

  private applyCruise(): void {
    const v01 = this.sliderValue / 100;
    const tr = this.getTarget();
    tr.command({ type: 'SET_CRUISE', value01: v01 }, this.rng);
    this.pushNoise('Parameter applied.');
  }

  private onSafe(): void {
    const tr = this.getTarget();
    tr.command({ type: 'BRAKE' }, this.rng);
    this.pushNoise('SAFE mode engaged.');
  }

  private onTurbo(): void {
    const tr = this.getTarget();
    tr.command({ type: 'ACCEL' }, this.rng);
    this.pushNoise('TURBO mode engaged.');
  }

  private onEco(): void {
    const tr = this.getTarget();

    tr.command(
      { type: 'STOP_TOGGLE_BAD' },
      this.rng,
      (info) => {
        // WARNING gets buried in noise log
        this.sim.accidents++;
        this.pushNoise('WARNING: ' + info);
      }
    );

    this.pushNoise('ECO toggled.');
  }
}
