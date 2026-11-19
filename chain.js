import { createChainView } from './chain-view.js';
import { createChainWorld, tickMs } from './chain-world.js';

const canvas = document.querySelector('#field');
canvas.tabIndex = 0;
const view = createChainView(canvas);
const delay = document.querySelector('#delay');
const message = document.querySelector('#message');
const loot = document.querySelector('#loot');
const rivalLoot = document.querySelector('#rival-loot');
const chainCount = document.querySelector('#chain-count');
const moveKeys = new Map([
    ['KeyA', 'left'],
    ['ArrowLeft', 'left'],
    ['KeyD', 'right'],
    ['ArrowRight', 'right'],
    ['KeyW', 'up'],
    ['ArrowUp', 'up'],
    ['KeyS', 'down'],
    ['ArrowDown', 'down'],
]);
const held = new Set();
let world = createChainWorld();
let pointer = null;
let destination = null;
let last = null;
let carry = 0;
let audio;
let sounded = new WeakSet();

function initAudio() {
    if (!window.AudioContext) return;
    audio ??= new AudioContext();
    if (audio.state !== 'running') void audio.resume().catch(() => {});
}

function playEffects(effects) {
    if (audio?.state !== 'running') return;
    for (const event of effects) {
        if (sounded.has(event)) continue;
        sounded.add(event);
        const notes = {
            preview: [385, 180, 0.045, 'sine'],
            swing: [220, 76, 0.085, 'triangle'],
            crack: [330 + event.tier * 80, 85, 0.1, 'triangle'],
            break: [175 + event.tier * 70, 42, 0.145, 'triangle'],
            collect: [595, 785, 0.055, 'sine'],
        };
        const note = notes[event.kind];
        if (!note) continue;
        const [high, low, duration, shape] = note;
        const when = audio.currentTime;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = shape;
        oscillator.frequency.setValueAtTime(high, when);
        oscillator.frequency.exponentialRampToValueAtTime(low, when + duration);
        gain.gain.setValueAtTime(0.075, when);
        gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.addEventListener('ended', () => {
            oscillator.disconnect();
            gain.disconnect();
        });
        oscillator.start(when);
        oscillator.stop(when + duration);
    }
}

function pointAt(event) {
    const point = view.worldPoint(event.clientX, event.clientY);
    if (!point) return null;
    const { width, height } = world.snapshot();
    return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height ? point : null;
}

canvas.addEventListener('pointermove', (event) => {
    pointer = pointAt(event);
});
canvas.addEventListener('pointerleave', () => {
    pointer = null;
});
canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    initAudio();
    const point = pointAt(event);
    if (!point) return;
    canvas.focus({ preventScroll: true });
    pointer = point;
    const ore = world.oreAt(point);
    if (ore) {
        world.command(ore, delay.value);
        destination = null;
    } else {
        destination = point;
    }
});
window.addEventListener('keydown', (event) => {
    if (!moveKeys.has(event.code) || event.target.closest?.('select, button, input')) return;
    event.preventDefault();
    if (!event.repeat) initAudio();
    held.add(event.code);
    destination = null;
});
window.addEventListener('keyup', (event) => held.delete(event.code));
window.addEventListener('blur', () => held.clear());
document.querySelector('#reset').addEventListener('click', () => {
    world = createChainWorld();
    sounded = new WeakSet();
    pointer = null;
    destination = null;
    held.clear();
    carry = 0;
    canvas.focus({ preventScroll: true });
});
function axis(negative, positive) {
    const actions = new Set([...held].map((key) => moveKeys.get(key)));
    return Number(actions.has(positive)) - Number(actions.has(negative));
}
function update(node, value) {
    if (node.textContent !== String(value)) node.textContent = value;
}
function frame(now) {
    if (last !== null) carry += Math.min(100, now - last);
    last = now;
    const input = { x: axis('left', 'right'), y: axis('up', 'down'), destination };
    while (carry >= tickMs) {
        world.step(input);
        carry -= tickMs;
    }
    const state = world.snapshot();
    update(loot, state.player.loot);
    update(
        rivalLoot,
        state.rivals.reduce((total, rival) => total + rival.loot, 0),
    );
    update(chainCount, state.maxChain);
    update(message, state.message);
    playEffects(state.effects);
    view.draw(state, pointer && { ...pointer, ore: world.oreAt(pointer)?.id ?? null });
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
