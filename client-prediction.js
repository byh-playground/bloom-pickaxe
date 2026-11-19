import { createFracturePhysics } from './fracture-physics.js';
import { dashRules, tickMs } from './fracture-world.js';

const maxLeadMs = 120;
const playerRadius = 13;
const playerBoundary = 24;
const correctionMs = 70;
const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));

export function createDashPrediction(Rapier) {
    const physics = createFracturePhysics(Rapier, true);
    const obstacles = new Map();
    const player = { x: 0, y: 0 };
    physics.add(player, playerRadius);
    let bounds, dash, time, frameAt, limit, receivedAt;
    let pending = [];
    let acknowledged = { x: 0, y: 0 };
    let held = acknowledged;
    let cursor = 0;
    let correction = null;
    let hurtAt = -Infinity;

    function updateColliders(state) {
        const active = new Set();
        function update(key, source, radius) {
            active.add(key);
            let actor = obstacles.get(key);
            if (!actor) {
                actor = { ...source };
                obstacles.set(key, actor);
                physics.add(actor, radius);
                return;
            }
            const changed = actor.polygon !== source.polygon;
            Object.assign(actor, source);
            if (changed && actor.polygon) physics.replaceHull(actor);
            physics.sync(actor);
        }
        for (const rock of state.rocks) update('rock:' + rock.uid, rock, rock.r * 1.1);
        for (const [index, obstacle] of state.obstacles.entries())
            update('obstacle:' + index, obstacle, obstacle.r);
        for (const other of state.others) update('peer:' + other.id, other, playerRadius);
        for (const [key, actor] of obstacles) {
            if (active.has(key)) continue;
            physics.remove(actor);
            obstacles.delete(key);
        }
    }

    function step(intent) {
        time += tickMs;
        if (dash.charges < dashRules.capacity && time >= dash.nextChargeAt) {
            dash.charges++;
            dash.nextChargeAt =
                dash.charges < dashRules.capacity ? dash.nextChargeAt + dashRules.rechargeMs : 0;
        }
        if (time >= dash.until) {
            dash.direction = null;
            const direction = held.x || held.y ? held : intent;
            const length = direction ? Math.hypot(direction.x, direction.y) : 0;
            if (dash.charges && length > 0 && time - player.hurtAt >= 120) {
                dash.direction = { x: direction.x / length, y: direction.y / length };
                dash.until = time + dashRules.durationMs;
                dash.charges--;
                if (!dash.nextChargeAt) dash.nextChargeAt = time + dashRules.rechargeMs;
            }
        }
        if (!dash.direction) return;
        const stride =
            (dashRules.distance * Math.min(tickMs, dash.until - time)) / dashRules.durationMs;
        const { x, y } = dash.direction;
        physics.move(player, {
            x:
                clamp(player.x + x * stride, playerBoundary, bounds.width - playerBoundary) -
                player.x,
            y:
                clamp(player.y + y * stride, playerBoundary, bounds.height - playerBoundary) -
                player.y,
        });
        player.faceX = x;
        player.faceY = y;
    }

    function advance(now) {
        const until = Math.min(now, limit);
        while (frameAt + tickMs <= until) {
            frameAt += tickMs;
            let intent = null;
            while (pending[cursor] && pending[cursor].at <= frameAt) {
                const command = pending[cursor++];
                held = command;
                intent = command.dashIntent ?? intent;
            }
            step(intent);
        }
    }

    function correctionAt(now) {
        const weight = correction ? Math.exp(-(now - correction.at) / correctionMs) : 0;
        return weight > 0.02
            ? { x: correction.x * weight, y: correction.y * weight }
            : { x: 0, y: 0 };
    }

    return {
        record(seq, input, now) {
            pending.push({ seq, ...input, at: now });
            if (pending.length > 128) {
                pending.shift();
                cursor = Math.max(0, cursor - 1);
            }
        },
        reconcile(state, now) {
            const ack = state.ackSeq;
            if (!Number.isSafeInteger(ack) || !state.bounds) {
                dash = null;
                return;
            }
            let previous;
            if (dash) {
                advance(now);
                const offset = correctionAt(now);
                previous = { x: player.x + offset.x, y: player.y + offset.y };
            }
            let first = 0;
            while (pending[first]?.seq <= ack) acknowledged = pending[first++];
            pending = pending.slice(first);
            held = acknowledged;
            cursor = 0;
            bounds = state.bounds;
            updateColliders(state);
            Object.assign(player, state.player);
            physics.sync(player);
            time = state.time;
            dash = { ...state.dash };
            receivedAt = now;
            limit = now + maxLeadMs;
            const replayMs = pending.length ? clamp(now - pending[0].at, 0, maxLeadMs) : 0;
            frameAt = now - replayMs - (pending.length ? tickMs : 0);
            advance(now);

            const dx = previous ? previous.x - player.x : 0;
            const dy = previous ? previous.y - player.y : 0;
            const delta = Math.hypot(dx, dy);
            correction =
                delta > 0.5 && delta < 65 && hurtAt === state.player.hurtAt
                    ? { x: dx, y: dy, at: now }
                    : null;
            hurtAt = state.player.hurtAt;
        },
        sample(now, displayTime) {
            if (!dash || now - receivedAt > maxLeadMs * 2) return null;
            advance(now);
            const offset = correctionAt(now);
            return {
                x: player.x + offset.x,
                y: player.y + offset.y,
                faceX: player.faceX,
                faceY: player.faceY,
                dash: {
                    ...dash,
                    until: dash.direction ? displayTime + dash.until - time : 0,
                    nextChargeAt: dash.nextChargeAt ? displayTime + dash.nextChargeAt - time : 0,
                },
            };
        },
        dispose: physics.dispose,
    };
}
