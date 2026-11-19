const sampleLimit = 240;
const targetFrameMs = 1000 / 60;

function summary(list) {
    if (!list.length) return null;
    const ordered = [...list].sort((a, b) => a - b);
    return {
        count: list.length,
        mean: list.reduce((sum, value) => sum + value, 0) / list.length,
        p95: ordered[Math.ceil(ordered.length * 0.95) - 1],
        max: ordered.at(-1),
    };
}

export function createRenderMetrics() {
    const windows = new Map();
    let previousFrame;
    let previousPacket;
    let previousServerTime;
    let lastOverlay = -Infinity;
    const panel = document.createElement('pre');
    panel.setAttribute('aria-label', '프레임 진단');
    panel.className = 'render-metrics';
    document.body.append(panel);

    function record(key, value) {
        if (!Number.isFinite(value)) return;
        let ring = windows.get(key);
        if (!ring) {
            ring = { values: [], cursor: 0 };
            windows.set(key, ring);
        }
        ring.values[ring.cursor] = value;
        ring.cursor = (ring.cursor + 1) % sampleLimit;
    }

    function snapshot() {
        const values = (key) => windows.get(key)?.values ?? [];
        const ratio = (key) => {
            const list = values(key);
            return list.length ? list.reduce((sum, n) => sum + n, 0) / list.length : null;
        };
        const scale = windows.get('renderScale');
        const frame = summary(values('frameMs'));
        return {
            fps: frame ? 1000 / frame.mean : null,
            frame,
            slowFrames: values('frameMs').filter((ms) => ms > targetFrameMs * 1.25).length,
            sample: summary(values('sampleMs')),
            draw: summary(values('drawMs')),
            hud: summary(values('hudMs')),
            snapshotGap: summary(values('snapshotGapMs')),
            serverAdvance: summary(values('serverAdvanceMs')),
            snapshotBytes: summary(values('snapshotBytes')),
            buffer: summary(values('bufferMs')),
            bufferEmptyRatio: ratio('bufferEmpty'),
            extrapolateRatio: ratio('extrapolateFrame'),
            playbackFrozenRatio: ratio('playbackFrozen'),
            targetBuffer: summary(values('targetBufferMs')),
            inputAck: summary(values('inputAckMs')),
            longTasks: summary(values('longTaskMs')),
            renderScale: scale
                ? scale.values[(scale.cursor + sampleLimit - 1) % sampleLimit]
                : null,
        };
    }

    const ms = (metric) => (metric ? metric.p95.toFixed(1) + 'ms' : '—');
    const pct = (value) => (value === null ? '—' : (value * 100).toFixed(1) + '%');
    const observer = globalThis.PerformanceObserver;
    if (observer?.supportedEntryTypes?.includes('longtask')) {
        new observer((list) => {
            for (const entry of list.getEntries()) record('longTaskMs', entry.duration);
        }).observe({ entryTypes: ['longtask'] });
    }

    const metrics = {
        record,
        snapshot,
        frame(now) {
            if (previousFrame !== undefined && now - previousFrame < 1000)
                record('frameMs', now - previousFrame);
            previousFrame = now;
        },
        packet(now, bytes, serverTime) {
            if (previousPacket !== undefined && now - previousPacket < 1000)
                record('snapshotGapMs', now - previousPacket);
            if (previousServerTime !== undefined && serverTime >= previousServerTime)
                record('serverAdvanceMs', serverTime - previousServerTime);
            previousPacket = now;
            previousServerTime = serverTime;
            record('snapshotBytes', bytes);
        },
        render(now) {
            if (now - lastOverlay < 500) return;
            lastOverlay = now;
            const s = snapshot();
            panel.textContent = [
                `FPS ${s.fps?.toFixed(1) ?? '—'}  ·  frame p95 ${ms(s.frame)}  ·  scale ${s.renderScale ?? '—'}`,
                `draw ${ms(s.draw)}  ·  sample ${ms(s.sample)}  ·  UI ${ms(s.hud)}`,
                `snapshot ${ms(s.snapshotGap)}  ·  buffer ${ms(s.buffer)}`,
                `server step ${s.serverAdvance?.mean.toFixed(1) ?? '—'}ms avg`,
                `empty ${pct(s.bufferEmptyRatio)}  ·  frozen ${pct(s.playbackFrozenRatio)}  ·  ack ${ms(s.inputAck)}`,
            ].join('\n');
        },
    };
    window.__pickaxePerformance = metrics;
    return metrics;
}
