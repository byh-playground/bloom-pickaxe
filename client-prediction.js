import { createFracturePhysics } from './fracture-physics.js';
import { clockToleranceMs, tickRate, walkDelta, walkSpeed } from './fracture-world.js';

const maxLeadMs = 120;
const playerRadius = 13;
const playerBoundary = 24;
const correctionMs = 70;
const maxDisplaySpeed = walkSpeed + 100;
const respawnDistance = 350;
const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));

export function createMovementPrediction(Rapier, serverTickRate = tickRate) {
    const tickMs = 1000 / serverTickRate;
    const physics = createFracturePhysics(Rapier, true);
    const obstacles = new Map();
    const player = { x: 0, y: 0 };
    physics.add(player, playerRadius);
    let bounds, frameAt, limit;
    let pending = [];
    let acknowledged = { x: 0, y: 0 };
    let held = acknowledged;
    let cursor = 0;
    let correction = null;
    let hurtAt = -Infinity;
    let displayed = null;
    let authoritative = null;

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
        for (const other of state.others)
            if (other.hp !== 0) update('peer:' + other.id, other, playerRadius);
        for (const [key, actor] of obstacles) {
            if (active.has(key)) continue;
            physics.remove(actor);
            obstacles.delete(key);
        }
    }

    function move(x, y, dt) {
        const delta = walkDelta(x, y, dt);
        physics.move(player, {
            x: clamp(player.x + delta.x, playerBoundary, bounds.width - playerBoundary) - player.x,
            y: clamp(player.y + delta.y, playerBoundary, bounds.height - playerBoundary) - player.y,
        });
    }
    function step() {
        if (player.hp === 0 || (!held.x && !held.y)) return;
        move(held.x, held.y, tickMs / 1000);
        const length = Math.hypot(held.x, held.y);
        player.faceX = held.x / length;
        player.faceY = held.y / length;
    }

    function advance(now) {
        const until = Math.min(now, limit);
        while (frameAt + tickMs <= until) {
            frameAt += tickMs;
            while (pending[cursor] && pending[cursor].at <= frameAt) held = pending[cursor++];
            step();
        }
    }

    function correctionAt(now) {
        const weight = correction ? Math.exp(-(now - correction.at) / correctionMs) : 0;
        return weight > 0.02
            ? { x: correction.x * weight, y: correction.y * weight }
            : { x: 0, y: 0 };
    }

    function presentationPose(now) {
        advance(now);
        const { x, y } = player;
        const elapsed = Math.max(0, Math.min(tickMs, Math.min(now, limit) - frameAt));
        const input = pending.at(-1) ?? held;
        if (player.hp === 0 || (!input.x && !input.y) || elapsed < clockToleranceMs)
            return { x, y };
        move(input.x, input.y, elapsed / 1000);
        const display = { x: player.x, y: player.y };
        player.x = x;
        player.y = y;
        physics.sync(player);
        return display;
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
                bounds = null;
                return;
            }
            const nextAuthority = {
                x: state.player.x,
                y: state.player.y,
                spawnRevision: state.player.spawnRevision,
            };
            if (
                authoritative &&
                (nextAuthority.spawnRevision !== authoritative.spawnRevision ||
                    Math.hypot(
                        nextAuthority.x - authoritative.x,
                        nextAuthority.y - authoritative.y,
                    ) > respawnDistance)
            )
                displayed = null;
            authoritative = nextAuthority;
            let first = 0;
            while (pending[first]?.seq <= ack) acknowledged = pending[first++];
            pending = pending.slice(first);
            held = acknowledged;
            cursor = 0;
            bounds = state.bounds;
            updateColliders(state);
            Object.assign(player, state.player);
            physics.sync(player);
            limit = now + maxLeadMs;
            const replayMs = pending.length ? clamp(now - pending[0].at, 0, maxLeadMs) : 0;
            frameAt = now - replayMs - (pending.length ? tickMs : 0);
            const pose = presentationPose(now);

            const dx = displayed ? displayed.x - pose.x : 0;
            const dy = displayed ? displayed.y - pose.y : 0;
            const delta = Math.hypot(dx, dy);
            correction =
                delta > 0.5 && hurtAt === state.player.hurtAt ? { x: dx, y: dy, at: now } : null;
            hurtAt = state.player.hurtAt;
        },
        sample(now) {
            if (!bounds) return null;
            const pose = presentationPose(now);
            const offset = correctionAt(now);
            const x = pose.x + offset.x;
            const y = pose.y + offset.y;
            if (displayed) {
                const distance = Math.hypot(x - displayed.x, y - displayed.y);
                const budget = (maxDisplaySpeed * clamp(now - displayed.at, 0, 50)) / 1000;
                const fraction = distance ? Math.min(1, budget / distance) : 1;
                displayed = {
                    x: displayed.x + (x - displayed.x) * fraction,
                    y: displayed.y + (y - displayed.y) * fraction,
                    at: now,
                };
            } else {
                displayed = { x, y, at: now };
            }
            return {
                x: displayed.x,
                y: displayed.y,
                faceX: player.faceX,
                faceY: player.faceY,
            };
        },
        dispose: physics.dispose,
    };
}
