import { createFractureWorld, minerals, tickMs, pickaxes } from './fracture-world.js';
import { createFractureView } from './fracture-view.js';
import { createStick } from './fracture-stick.js';
import {
    createOnlineClient,
    createPlayback,
    hasOnlineServer,
    normalizeServerOrigin,
} from './online-client.js';
import { createRenderMetrics } from './render-metrics.js';
import { loadGameServer } from './game-server-config.js';

const get = (id) => document.getElementById(id);
const canvas = get('field');
const arena = canvas.closest('.fracture');
const status = get('status');
const resetButton = get('reset');
const onlinePanel = get('online-panel');
const connectionStatus = get('connection-status');
const compass = get('center-compass');
const centerDistance = get('center-distance');
const tool = get('tool');
const nextTool = get('next-tool');
const ingredientList = get('ingredients');
const ingredients = Object.entries(minerals).map(([id, ore]) => {
    const item = document.createElement('li');
    const gem = document.createElement('i');
    const title = document.createElement('span');
    const count = document.createElement('b');
    gem.className = 'chip';
    gem.style.setProperty('--ore', ore.color);
    gem.style.setProperty('--ore-light', ore.light);
    gem.setAttribute('aria-hidden', 'true');
    title.textContent = ore.name;
    item.append(gem, title, count);
    ingredientList.append(item);
    return { id, item, count };
});
const touchControls = arena.querySelector('.touch-sticks');
const touchScreen = matchMedia('(pointer: coarse)');
const view = createFractureView(canvas, touchControls);
canvas.tabIndex = 0;
const params = new URLSearchParams(location.search);
const metrics = params.get('perf') === '1' ? createRenderMetrics() : null;
const seedParam = params.get('seed');
const seed =
    seedParam !== null && /^\d+$/.test(seedParam)
        ? Number(seedParam) >>> 0
        : crypto.getRandomValues(new Uint32Array(1))[0];
status.textContent = '채굴터 준비 중…';
const offline = params.get('offline') === '1';
const configuredServer = offline ? null : (params.get('server') ?? (await loadGameServer()));
const forceOnline = !offline && (params.get('online') === '1' || configuredServer !== null);
const serverOrigin =
    configuredServer === null ? location.origin : normalizeServerOrigin(configuredServer);
if (params.has('server') && serverOrigin) {
    const menuUrl = new URL('./', location.href);
    menuUrl.searchParams.set('server', serverOrigin);
    get('return-menu').href = menuUrl;
}
const capabilities = !offline && serverOrigin && (await hasOnlineServer(serverOrigin));
const loadRapier = () =>
    import('https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat@0.21.0/dist/rapier.mjs')
        .then(async ({ default: engine }) => {
            await engine.init();
            return engine;
        })
        .catch(() => null);
const online = capabilities
    ? createOnlineClient(
          updateConnection,
          serverOrigin,
          capabilities,
          capabilities.geometry === 1 ? loadRapier() : null,
          metrics,
      )
    : null;
const Rapier = !online && !forceOnline ? await loadRapier() : null;
if (!online && !forceOnline && !Rapier)
    status.textContent = '충돌 모듈을 불러오지 못했어요. 새로고침해 주세요.';
let world = Rapier ? createFractureWorld(Rapier, seed) : null;
let offlinePlayback = world ? createPlayback(tickMs) : null;
if (world) offlinePlayback.push(world.state);
let lastFrame;
let lastHudFrame = -Infinity;
let renderedLevel = -1;
let carry = 0;
let sound;
let impactNoise;
const held = new Set();
const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
let heard = new WeakSet();
let queuedAttack = false;
let sentMovement = '';
let sentAt = -Infinity;
const movePad = get('move-stick');
const moveStick = createStick(movePad, audioReady, {
    onVector() {
        if (online) sendInput(performance.now());
    },
});
const attackButton = get('attack-button');

function requestAttack() {
    audioReady();
    if (online) {
        if (online.info().phase !== 'online') return;
        queuedAttack = true;
        sendInput(performance.now());
    } else {
        world?.attack();
    }
}
attackButton.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    requestAttack();
});
attackButton.addEventListener('click', (event) => {
    if (event.detail === 0) requestAttack();
});

function resetInputs() {
    queuedAttack = false;
    held.clear();
    moveStick.reset();
    world?.cancelAttack();
    if (online) online.send({ x: 0, y: 0, attack: false });
    sentMovement = '';
}

function updateConnection({ phase, channelId } = { phase: 'unavailable' }) {
    onlinePanel.hidden = false;
    onlinePanel.dataset.phase = phase;
    compass.hidden = phase !== 'online';
    resetButton.hidden = phase === 'online' || phase === 'connecting';
    resetButton.title = '다시 연결';
    resetButton.setAttribute('aria-label', '다시 연결');
    if (phase === 'online') {
        resetInputs();
        updateText(connectionStatus, '채널 ' + channelId);
        updateText(status, '');
    } else if (phase === 'connecting') {
        updateText(connectionStatus, '접속 중');
        updateText(status, '공유 채굴터에 연결하는 중이에요.');
    } else {
        resetInputs();
        updateText(connectionStatus, '연결 끊김');
        updateText(status, '공유 채굴터에 연결하지 못했어요. 다시 연결해 주세요.');
    }
}

function updateText(node, text) {
    if (node.textContent !== String(text)) node.textContent = text;
}
function audioReady() {
    if (!window.AudioContext) return;
    sound ??= new AudioContext();
    if (sound.state !== 'running') void sound.resume().catch(() => {});
}
function strikeSound(mark, now) {
    if (!impactNoise) {
        impactNoise = sound.createBuffer(1, Math.round(sound.sampleRate * 0.12), sound.sampleRate);
        const samples = impactNoise.getChannelData(0);
        let value = 3701;
        for (let i = 0; i < samples.length; i++) {
            value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
            samples[i] = value / 2147483648 - 1;
        }
    }
    const strength = mark.strength ?? 0.75;
    const hard = mark.kind === 'clink';
    const rock = mark.kind === 'cut' || mark.kind === 'split' || mark.kind === 'finisher';
    const split = mark.kind === 'split';
    const air = mark.kind === 'swing';
    const grit = sound.createBufferSource();
    const band = sound.createBiquadFilter();
    const crack = sound.createGain();
    grit.buffer = impactNoise;
    grit.playbackRate.value = hard ? 1.45 : 1;
    band.type = 'bandpass';
    band.frequency.value = air ? 820 : hard ? 2850 : split ? 1160 : rock ? 1680 : 690;
    band.Q.value = hard ? 2.7 : 0.8;
    crack.gain.setValueAtTime(strength * (air ? 0.07 : hard ? 0.2 : 0.25), now);
    crack.gain.exponentialRampToValueAtTime(0.001, now + (hard ? 0.035 : 0.09));
    grit.connect(band).connect(crack).connect(sound.destination);
    grit.onended = () => {
        grit.disconnect();
        band.disconnect();
        crack.disconnect();
    };
    grit.start(now);
    if (air) return;

    const thump = sound.createOscillator();
    const volume = sound.createGain();
    thump.type = hard ? 'triangle' : 'sine';
    thump.frequency.setValueAtTime(hard ? 465 : rock ? 145 : 105, now);
    thump.frequency.exponentialRampToValueAtTime(hard ? 245 : 45, now + 0.075);
    volume.gain.setValueAtTime(hard ? 0.035 : strength * 0.17, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thump.connect(volume).connect(sound.destination);
    thump.onended = () => {
        thump.disconnect();
        volume.disconnect();
    };
    thump.start(now);
    thump.stop(now + 0.11);
}
function playSounds(state) {
    if (sound?.state !== 'running') return;
    for (const mark of state.marks) {
        if (heard.has(mark) || state.time < mark.at) continue;
        heard.add(mark);
        if (online && Math.hypot(state.player.x - mark.x, state.player.y - mark.y) > 380) continue;
        const now = sound.currentTime;
        if (
            mark.kind === 'swing' ||
            mark.kind === 'cut' ||
            mark.kind === 'finisher' ||
            mark.kind === 'split' ||
            mark.kind === 'clink' ||
            mark.kind === 'hurt' ||
            mark.kind === 'slam'
        ) {
            strikeSound(mark, now);
            continue;
        }
        const frequency = { collect: 705, upgrade: 825 }[mark.kind];
        if (!frequency) continue;
        const osc = sound.createOscillator(),
            gain = sound.createGain();
        osc.frequency.setValueAtTime(frequency, now);
        osc.frequency.exponentialRampToValueAtTime(
            mark.kind === 'collect' ? frequency * 1.23 : frequency * 0.49,
            now + 0.09,
        );
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(sound.destination);
        osc.start(now);
        osc.stop(now + 0.12);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    }
}
function refresh(state) {
    const current = pickaxes[state.level];
    const next = pickaxes[state.level + 1];
    if (renderedLevel !== state.level) {
        renderedLevel = state.level;
        updateText(tool, current.name);
        tool.style.setProperty('--tool-color', current.color);
        updateText(nextTool, next ? '다음 · ' + next.name : '다이아 곡괭이 완성');
        for (const { id, item } of ingredients) item.hidden = next ? !(id in next.recipe) : false;
    }
    for (const { id, item, count } of ingredients) {
        if (item.hidden) continue;
        const need = next?.recipe[id];
        updateText(count, need ? state.bag[id] + '/' + need : state.bag[id]);
    }
    updateText(
        status,
        (online && online.info().phase !== 'online'
            ? '연결이 끊겼어요. 다시 연결해 주세요.'
            : state.message) ||
            (touchScreen.matches
                ? '오른쪽 버튼으로 금 내기 · 왼쪽 스틱으로 밀어 깨기'
                : '클릭으로 금 내기 · WASD로 밀어 깨기'),
    );
    if (online && online.info().phase === 'online') {
        const { channelId } = online.info();
        const count = Number.isInteger(state.population) ? ' · ' + state.population + '명' : '';
        updateText(connectionStatus, '채널 ' + channelId + count);
        compass.hidden = !state.center;
        if (state.center) {
            const x = state.center.x - state.player.x;
            const y = state.center.y - state.player.y;
            const distance = Math.hypot(x, y);
            const bearing = view.screenAngle({ x, y });
            compass.style.setProperty('--bearing', bearing + 'rad');
            updateText(centerDistance, distance < 95 ? '대광맥' : '대광맥 ' + Math.round(distance));
        }
    }
}

function getAxes() {
    const stick = moveStick.read();
    if (stick.x || stick.y) return view.stickVector(stick);
    const any = (...a) => a.some((key) => held.has(key));
    return view.worldVector(
        Number(any('KeyD', 'ArrowRight')) - Number(any('KeyA', 'ArrowLeft')),
        Number(any('KeyS', 'ArrowDown')) - Number(any('KeyW', 'ArrowUp')),
    );
}
function sendInput(now) {
    if (!online) return;
    const { x, y } = getAxes();
    const movement = x.toFixed(3) + ':' + y.toFixed(3);
    if (!queuedAttack && movement === sentMovement && now - sentAt < 100) return;
    if (!online.send({ x, y, attack: queuedAttack })) return;
    sentMovement = movement;
    sentAt = now;
    queuedAttack = false;
}
canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    canvas.focus({ preventScroll: true });
    requestAttack();
});
resetButton.addEventListener('click', () => {
    resetInputs();
    if (online) {
        online.connect();
        return;
    }
    if (!world) {
        location.reload();
        return;
    }
    world.dispose();
    world = createFractureWorld(Rapier, seed);
    offlinePlayback = createPlayback(tickMs);
    offlinePlayback.push(world.state);
    carry = 0;
    heard = new WeakSet();
    canvas.focus({ preventScroll: true });
    refresh(world.state);
});
window.addEventListener('keydown', (e) => {
    if (!keys.includes(e.code) || e.target.closest?.('button,select,input')) return;
    e.preventDefault();
    if (e.repeat || held.has(e.code)) return;
    held.add(e.code);
    if (online) sendInput(performance.now());
});
window.addEventListener('keyup', (e) => {
    if (held.delete(e.code) && online) sendInput(performance.now());
});
window.addEventListener('blur', resetInputs);
window.addEventListener('pagehide', resetInputs);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetInputs();
});
touchScreen.addEventListener('change', resetInputs);

function frame(now) {
    metrics?.frame(now);
    const sampleStart = metrics ? performance.now() : 0;
    let state;
    if (online) {
        sendInput(now);
        state = online.sample(now);
    } else if (world) {
        if (lastFrame !== undefined) carry += Math.min(80, now - lastFrame);
        lastFrame = now;
        const axes = getAxes();
        while (carry >= tickMs) {
            world.step(axes);
            offlinePlayback.push(world.state);
            carry -= tickMs;
        }
        state = offlinePlayback.sample(now);
    }
    if (metrics) metrics.record('sampleMs', performance.now() - sampleStart);
    if (state) {
        const drawStart = metrics ? performance.now() : 0;
        view.draw(state, now);
        if (metrics) metrics.record('drawMs', performance.now() - drawStart);
        metrics?.record('renderScale', view.renderScale());
        playSounds(state);
        if (now - lastHudFrame >= tickMs) {
            lastHudFrame = now;
            const hudStart = metrics ? performance.now() : 0;
            refresh(state);
            if (metrics) metrics.record('hudMs', performance.now() - hudStart);
        }
    }
    metrics?.render(now);
    requestAnimationFrame(frame);
}
if (online) online.connect();
else if (forceOnline) updateConnection();
else if (world) {
    updateText(connectionStatus, '혼자 연습');
    onlinePanel.hidden = false;
    refresh(world.state);
    view.draw(world.state);
}
requestAnimationFrame(frame);
