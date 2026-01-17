import Phaser from 'phaser';


export function makeButton(opts: {
scene: Phaser.Scene;
x: number;
y: number;
w: number;
h: number;
label: string;
onClick: () => void;
fontSize?: number;
padding?: number;
alpha?: number;
}): { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
const { scene, x, y, w, h, label, onClick } = opts;
const fs = opts.fontSize ?? 18;
const alpha = opts.alpha ?? 1;


const bg = scene.add.rectangle(x, y, w, h, 0x2a2a2f, alpha).setStrokeStyle(2, 0x4a4a52);
bg.setInteractive({ useHandCursor: true });


const text = scene.add.text(x, y, label, {
fontSize: `${fs}px`,
color: '#f2f2f2'
}).setOrigin(0.5);


bg.on('pointerdown', () => onClick());


bg.on('pointerover', () => bg.setFillStyle(0x34343a, alpha));
bg.on('pointerout', () => bg.setFillStyle(0x2a2a2f, alpha));


return { bg, text };
}


export function formatSeconds(s: number | null): string {
if (s === null) return '--';
const x = Math.max(0, s);
return x.toFixed(1);
}


export function trendArrow(trend: -1 | 0 | 1): string {
if (trend === 1) return '↑';
if (trend === -1) return '↓';
return '→';
}