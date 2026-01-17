import { BaseGameScene } from './BaseGameScene';
import { makeButton, formatSeconds, trendArrow } from '../ui/uiHelpers';

export class GoodUIScene extends BaseGameScene {
  private panelA!: Phaser.GameObjects.Container;
  private panelB!: Phaser.GameObjects.Container;

  private speedTextA!: Phaser.GameObjects.Text;
  private speedTextB!: Phaser.GameObjects.Text;
  private ttiTextA!: Phaser.GameObjects.Text;
  private ttiTextB!: Phaser.GameObjects.Text;

  private riskLamp!: Phaser.GameObjects.Ellipse;
  private riskLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('GoodUIScene');
    this.mode = 'good';
  }

  protected createUI(): void {
    // Risk header (top: important)
    this.riskLamp = this.add.ellipse(770, 20, 18, 18, 0x00ff00, 1).setStrokeStyle(2, 0x101010);
    this.riskLabel = this.add.text(792, 10, 'Risiko: gruen', { fontSize: '14px', color: '#eaeaea' });

    // Panels
    this.panelA = this.createTrainPanel({
      x: 740,
      y: 90,
      title: 'Zug A',
      color: 0x4aa3ff,
      onAccel: () => this.sim.trainA.command({ type: 'ACCEL' }, () => 0.5),
      onBrake: () => this.sim.trainA.command({ type: 'BRAKE' }, () => 0.5),
      onStop: () => this.sim.trainA.command({ type: 'STOP_SOFT' }, () => 0.5),
    });

    this.panelB = this.createTrainPanel({
      x: 740,
      y: 330,
      title: 'Zug B',
      color: 0xff6a6a,
      onAccel: () => this.sim.trainB.command({ type: 'ACCEL' }, () => 0.5),
      onBrake: () => this.sim.trainB.command({ type: 'BRAKE' }, () => 0.5),
      onStop: () => this.sim.trainB.command({ type: 'STOP_SOFT' }, () => 0.5),
    });

    // capture references inside panels
    this.speedTextA = this.panelA.getByName('speed') as Phaser.GameObjects.Text;
    this.ttiTextA = this.panelA.getByName('tti') as Phaser.GameObjects.Text;
    this.speedTextB = this.panelB.getByName('speed') as Phaser.GameObjects.Text;
    this.ttiTextB = this.panelB.getByName('tti') as Phaser.GameObjects.Text;

    // Small secondary logs (bottom-right)
    this.add.rectangle(835, 565, 290, 60, 0x0f0f14, 0.9).setStrokeStyle(1, 0x2b2b35);
    this.add.text(
      695,
      540,
      'Tip: Wenn beide Zuege fast gleichzeitig\n' +
        'an der Kreuzung sind => hohes Risiko.\n' +
        'STOP ist immer sicher (sanft).',
      { fontSize: '12px', color: '#cfcfe8' }
    );

    this.smallHintText.setText('Good UI: separate Panels, klare Actions, Live-Feedback, Risikoampel.');
  }

private createTrainPanel(opts: {
  x: number;
  y: number;
  title: string;
  color: number;
  onAccel: () => void;
  onBrake: () => void;
  onStop: () => void;
}): Phaser.GameObjects.Container {
  const w = 300;
  const h = 180;

  const bg = this.add.rectangle(0, 0, w, h, 0x14141a, 0.95).setStrokeStyle(2, 0x3a3a46);

  const title = this.add.text(-w / 2 + 14, -h / 2 + 10, opts.title, {
    fontSize: '16px',
    color: '#ffffff',
  });

  const dot = this.add.circle(-w / 2 + 82, -h / 2 + 18, 6, opts.color, 1);

  const speed = this.add
    .text(-w / 2 + 14, -h / 2 + 46, 'v = 0.0 →', { fontSize: '14px', color: '#eaeaea' })
    .setName('speed');

  const tti = this.add
    .text(-w / 2 + 14, -h / 2 + 72, 'Zeit bis Kreuzung: --', { fontSize: '14px', color: '#eaeaea' })
    .setName('tti');

  // Panel-Container
  const cont = this.add.container(w / 2, opts.y + h / 2, [bg, title, dot, speed, tti]);

  // Buttons: positions are in SCENE coordinates, aligned with panel top-left (opts.x, opts.y)
  const leftColX = opts.x + 20;   // center of 170px button (20 margin + half width)
  const stopX    = opts.x + 170; // after left buttons + gap + half of stop width

  const y1 = opts.y + 65; // accel
  const y2 = opts.y + 117; // brake
  const yStop = opts.y + 91;

  makeButton({
    scene: this,
    x: leftColX,
    y: y1,
    w: 170,
    h: 44,
    label: 'Beschleunigen',
    onClick: opts.onAccel,
    fontSize: 16,
  });

  makeButton({
    scene: this,
    x: leftColX,
    y: y2,
    w: 170,
    h: 44,
    label: 'Bremsen',
    onClick: opts.onBrake,
    fontSize: 16,
  });

  makeButton({
    scene: this,
    x: stopX,
    y: yStop,
    w: 90,
    h: 96,
    label: 'STOP',
    onClick: opts.onStop,
    fontSize: 18,
  });

  return cont;
}


  protected override renderFrame(snap: any): void {
    super.renderFrame(snap);

    // Update panel values
    this.speedTextA.setText(`v = ${snap.trainA.speed.toFixed(1)} ${trendArrow(snap.trainA.speedTrend)}`);
    this.speedTextB.setText(`v = ${snap.trainB.speed.toFixed(1)} ${trendArrow(snap.trainB.speedTrend)}`);

    this.ttiTextA.setText(`Zeit bis Kreuzung: ${formatSeconds(snap.trainA.timeToIntersection)} s`);
    this.ttiTextB.setText(`Zeit bis Kreuzung: ${formatSeconds(snap.trainB.timeToIntersection)} s`);

    // Risk lamp
    const risk = snap.risk as 'green' | 'yellow' | 'red';
    if (risk === 'green') {
      this.riskLamp.setFillStyle(0x22dd55);
      this.riskLabel.setText('Risiko: gruen');
    } else if (risk === 'yellow') {
      this.riskLamp.setFillStyle(0xffcc33);
      this.riskLabel.setText('Risiko: gelb');
    } else {
      this.riskLamp.setFillStyle(0xff3344);
      this.riskLabel.setText('Risiko: rot');
    }
  }
}
