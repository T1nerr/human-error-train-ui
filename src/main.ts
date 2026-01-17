import Phaser from 'phaser';
import './style.css';


import { BadUIScene } from './scenes/BadUIScene';
import { GoodUIScene } from './scenes/GoodUIScene';


function pickSceneKey(): 'bad' | 'good' {
const h = (window.location.hash || '#bad').toLowerCase();
return h.includes('good') ? 'good' : 'bad';
}


const sceneKey = pickSceneKey();


const config: Phaser.Types.Core.GameConfig = {
type: Phaser.AUTO,
parent: 'game',
width: 980,
height: 600,
backgroundColor: '#0f0f12',
fps: { target: 60, forceSetTimeOut: true },
scene: sceneKey === 'bad' ? [BadUIScene] : [GoodUIScene]
};


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Phaser.Game(config);


window.addEventListener('hashchange', () => {
// simple reload when switching mode
window.location.reload();
});