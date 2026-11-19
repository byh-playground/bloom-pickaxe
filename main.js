import { createMockState, cameraSpots, hitSamples } from './mock-world.js';
import { mapSize, regions, screensPerSide } from './map-layout.js';
import { createView } from './view.js';

const canvas = document.querySelector('#field');
const view = createView(canvas);
const hitPreview = document.querySelector('#hit-preview');
const inventory = document.querySelector('#inventory');
const bossStatus = document.querySelector('#boss-status');
const toolName = document.querySelector('#tool-name');
const toolTier = document.querySelector('#tool-tier');
const requirements = document.querySelector('#requirements');
const mapPaper = document.querySelector('.map-paper');
const mapRegion = document.querySelector('#map-region');
const mapCamera = document.querySelector('#map-camera');
document.querySelector('#map-size').textContent = `${screensPerSide} × ${screensPerSide} 화면`;

const minerals = [
    { name: '구리', color: '#c6804c' },
    { name: '청석', color: '#4c9abb' },
    { name: '자수정', color: '#ae71af' },
    { name: '황금 핵석', color: '#cf9c35' },
];
const params = new URLSearchParams(location.search);
const camera = { ...cameraSpots[params.get('at') === 'boss' ? 'boss' : 'meadow'] };
const start = performance.now();
let strike = null;
let drag = null;
let nearby = null;

function fillInventory(player) {
    const rows = minerals.map((mineral, index) => {
        const row = document.createElement('li');
        const chip = document.createElement('span');
        const count = document.createElement('strong');
        const label = document.createElement('span');
        chip.className = 'ore-chip';
        chip.style.setProperty('--ore', mineral.color);
        chip.setAttribute('aria-hidden', 'true');
        count.textContent = player.loot[index] ?? 0;
        label.textContent = mineral.name;
        row.append(chip, count, label);
        return row;
    });
    inventory.replaceChildren(...rows);
    toolName.textContent = `${minerals[player.level].name} 곡갱이`;
    toolTier.textContent = `${player.level + 1}등급`;
    requirements.textContent = '다음 강화 · 구리 5 + 청석 3';
}

function placeOnMap(element, point) {
    element.style.left = `${50 + (100 * point.x) / mapSize.width}%`;
    element.style.top = `${50 + (100 * point.y) / mapSize.height}%`;
}

function moveCamera(x, y) {
    camera.x = Math.max(-mapSize.width / 2, Math.min(mapSize.width / 2, x));
    camera.y = Math.max(-mapSize.height / 2, Math.min(mapSize.height / 2, y));
    placeOnMap(mapCamera, camera);
    nearby = Object.keys(cameraSpots).find((key) => {
        const spot = cameraSpots[key];
        return Math.hypot(camera.x - spot.x, camera.y - spot.y) < 380;
    });
    mapRegion.textContent = nearby ? regions[nearby].name : '초원 둘러보기';
    hitPreview.disabled = !nearby;
}

for (const pin of document.querySelectorAll('[data-map-pin]')) {
    const spot = regions[pin.dataset.mapPin];
    placeOnMap(pin, spot);
    pin.addEventListener('click', (event) => {
        event.stopPropagation();
        const { x, y } = cameraSpots[pin.dataset.mapPin];
        moveCamera(x, y);
    });
}
mapPaper.addEventListener('click', (event) => {
    const rect = mapPaper.getBoundingClientRect();
    moveCamera(
        ((event.clientX - rect.left) / rect.width - 0.5) * mapSize.width,
        ((event.clientY - rect.top) / rect.height - 0.5) * mapSize.height,
    );
});

canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || drag) return;
    canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return;
    const delta = view.panDelta(drag.x - event.clientX, drag.y - event.clientY);
    moveCamera(camera.x + delta.x, camera.y + delta.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, (event) => {
        if (drag?.id !== event.pointerId) return;
        drag = null;
        canvas.classList.remove('dragging');
    });
}
hitPreview.addEventListener('click', () => {
    if (nearby) strike = { ...hitSamples[nearby], at: performance.now() - start };
});

const fixedTime = params.has('time') ? Number(params.get('time')) : NaN;
function frame(timestamp) {
    const elapsed = Math.max(0, timestamp - start);
    const now = Number.isFinite(fixedTime) && !strike ? fixedTime : elapsed;
    view.render(createMockState(now, strike), 'player', camera);
    requestAnimationFrame(frame);
}

const initial = createMockState(0);
const boss = initial.ores.find((ore) => ore.boss);
bossStatus.textContent = `${minerals[boss.tier].name} · ${boss.hp}/${boss.maxHp}`;
fillInventory(initial.players.find((player) => player.id === 'player'));
moveCamera(camera.x, camera.y);
requestAnimationFrame(frame);
