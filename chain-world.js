export const tickMs = 10;
const width = 920;
const height = 600;
const swingRange = 104;
const swingCooldownMs = 350;
const fragmentFlightMs = 200;
const fragmentClaimMs = 900;
const deeperChainClaimMs = 150;
const materials = [
    { r: 25, mass: 1.6, hp: 3, drag: 1.05, bounce: 0.78 },
    { r: 27, mass: 1, hp: 3, drag: 0.68, bounce: 0.95 },
    { r: 28, mass: 0.85, hp: 2, drag: 1.3, bounce: 0.68 },
];
const placements = [
    [220, 322, 0],
    [330, 322, 0],
    [440, 322, 1],
    [549, 322, 2],
    [417, 225, 2],
    [499, 195, 0],
    [610, 192, 1],
    [660, 390, 2],
    [715, 285, 0],
    [629, 470, 1],
    [307, 445, 0],
    [483, 446, 2],
];
const rocks = [
    { x: 775, y: 330, r: 51 },
    { x: 334, y: 184, r: 44 },
    { x: 554, y: 492, r: 32 },
];
const playerSpeed = 272;
const rivalSpeed = 128;
const minimumImpact = 115;
const baseImpulse = 1170;
const unit = (x, y) => {
    const length = Math.hypot(x, y);
    return length ? { x: x / length, y: y / length } : { x: 0, y: 0 };
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createChainWorld() {
    const player = { x: 151, y: 322, r: 18, faceX: 1, faceY: 0, swing: 0, loot: 0 };
    const rivals = [
        { x: 590, y: 265, r: 16, loot: 0 },
        { x: 388, y: 393, r: 16, loot: 0 },
    ];
    const ores = placements.map(([x, y, tier], id) => ({
        id,
        x,
        y,
        tier,
        r: materials[tier].r,
        mass: materials[tier].mass,
        hp: materials[tier].hp,
        maxHp: materials[tier].hp,
        vx: 0,
        vy: 0,
        depth: 0,
        crackAt: -Infinity,
    }));
    const state = {
        width,
        height,
        nowMs: 0,
        player,
        rivals,
        rocks,
        ores,
        shards: [],
        effects: [],
        maxChain: 0,
        collisions: 0,
        hits: 0,
        feedbackAt: null,
        impactAt: null,
        lastImpactAt: null,
        level: 0,
        pending: false,
        message: '가까운 구리를 눌러 일렬로 선 광석을 튕겨 보세요.',
    };
    let request = null;
    let cooldownUntil = 0;
    let swingUntil = 0;
    let nextShard = 0;

    function effect(kind, x, y, tier, depth = 0) {
        state.effects.push({ kind, x, y, tier, depth, ageMs: 0 });
    }

    function keepInside(actor) {
        actor.x = clamp(actor.x, actor.r, width - actor.r);
        actor.y = clamp(actor.y, actor.r, height - actor.r);
    }

    function actorMove(actor, dx, dy) {
        actor.x += dx;
        actor.y += dy;
        keepInside(actor);
        for (const rock of rocks) {
            const gap = distance(actor, rock);
            if (gap >= actor.r + rock.r) continue;
            const normal = gap ? unit(actor.x - rock.x, actor.y - rock.y) : { x: 1, y: 0 };
            actor.x = rock.x + normal.x * (actor.r + rock.r);
            actor.y = rock.y + normal.y * (actor.r + rock.r);
        }
        keepInside(actor);
    }

    function oreAt(point) {
        return ores
            .filter((ore) => ore.hp > 0 && distance(ore, point) <= ore.r + 18)
            .sort((a, b) => distance(a, point) - distance(b, point))[0];
    }

    function targetOre() {
        return request && ores.find((ore) => ore.id === request.id && ore.hp > 0);
    }

    function command(ore, mode) {
        if (!ore || ore.hp <= 0 || request || state.nowMs < cooldownUntil) return false;
        request = { id: ore.id, mode, dueAt: null };
        state.pending = true;
        return true;
    }

    function swing(ore, kind) {
        const aim = unit(ore.x - player.x, ore.y - player.y);
        player.faceX = aim.x;
        player.faceY = aim.y;
        swingUntil = state.nowMs + 230;
        effect(kind, ore.x, ore.y, ore.tier);
        state.feedbackAt = state.nowMs;
        return aim;
    }

    function advanceRequest() {
        const ore = targetOre();
        if (!ore) {
            request = null;
            state.pending = false;
            return;
        }
        if (request.dueAt === null) {
            if (distance(player, ore) > swingRange) return;
            request.dueAt = state.nowMs + (request.mode === '0' ? 0 : 120);
            if (request.mode === 'feedback') swing(ore, 'preview');
        }
        if (state.nowMs < request.dueAt) return;
        if (distance(player, ore) <= swingRange) {
            const aim =
                request.mode === 'feedback'
                    ? unit(ore.x - player.x, ore.y - player.y)
                    : swing(ore, 'swing');
            if (request.mode === 'feedback') effect('swing', ore.x, ore.y, ore.tier);
            const force = (baseImpulse * (1 + state.level * 0.28)) / ore.mass;
            ore.vx = aim.x * force;
            ore.vy = aim.y * force;
            ore.depth = 1;
            state.hits++;
            state.impactAt = state.nowMs;
            state.message = '광석이 날아갔어요. 충돌한 자리로 가서 파편을 주우세요.';
        } else {
            state.message = '광석이 사거리에서 벗어났어요.';
        }
        cooldownUntil = state.nowMs + swingCooldownMs;
        request = null;
        state.pending = false;
    }

    function scatter(ore, count, depth, nx, ny) {
        for (let i = 0; i < count; i++) {
            const angle = Math.atan2(ny, nx) + (i - (count - 1) / 2) * 1.1;
            const speed = 115 + (nextShard++ % 3) * 43;
            state.shards.push({
                x: ore.x + Math.cos(angle) * (ore.r * 0.65),
                y: ore.y + Math.sin(angle) * (ore.r * 0.65),
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                tier: ore.tier,
                landsAt: state.nowMs + fragmentFlightMs,
                opensAt:
                    state.nowMs +
                    fragmentFlightMs +
                    fragmentClaimMs +
                    Math.max(0, Math.min(3, depth - 2)) * deeperChainClaimMs,
                locked: true,
            });
        }
    }

    function crack(ore, depth, nx, ny) {
        if (ore.hp <= 0 || state.nowMs - ore.crackAt < 140) return;
        ore.crackAt = state.nowMs;
        ore.hp--;
        scatter(ore, ore.hp ? 1 : ore.tier === 2 ? 3 : 2, depth, nx, ny);
        effect(ore.hp ? 'crack' : 'break', ore.x, ore.y, ore.tier, depth);
    }

    function registerImpact(depth) {
        state.collisions++;
        state.maxChain = Math.max(state.maxChain, depth);
        state.lastImpactAt = state.nowMs;
    }

    function hitWall(ore, nx, ny) {
        const speed = -(ore.vx * nx + ore.vy * ny);
        if (speed <= 0) return;
        const impulse = speed * (1 + materials[ore.tier].bounce);
        ore.vx += impulse * nx;
        ore.vy += impulse * ny;
        if (speed >= minimumImpact && ore.depth) {
            registerImpact(ore.depth);
            crack(ore, ore.depth, nx, ny);
        }
    }

    function moveOre(ore, dt) {
        ore.x += ore.vx * dt;
        ore.y += ore.vy * dt;
        if (ore.x < ore.r) hitWall(ore, 1, 0);
        if (ore.x > width - ore.r) hitWall(ore, -1, 0);
        if (ore.y < ore.r) hitWall(ore, 0, 1);
        if (ore.y > height - ore.r) hitWall(ore, 0, -1);
        keepInside(ore);
        for (const rock of rocks) {
            const gap = distance(ore, rock);
            if (gap >= ore.r + rock.r) continue;
            const normal = gap ? unit(ore.x - rock.x, ore.y - rock.y) : { x: 1, y: 0 };
            ore.x = rock.x + normal.x * (ore.r + rock.r);
            ore.y = rock.y + normal.y * (ore.r + rock.r);
            hitWall(ore, normal.x, normal.y);
        }
        const decay = Math.exp(-materials[ore.tier].drag * dt);
        ore.vx *= decay;
        ore.vy *= decay;
        if (Math.hypot(ore.vx, ore.vy) < 9) {
            ore.vx = 0;
            ore.vy = 0;
            ore.depth = 0;
        }
    }

    function collide(a, b) {
        const gap = distance(a, b);
        const contact = a.r + b.r;
        if (gap >= contact) return;
        const normal = gap ? unit(b.x - a.x, b.y - a.y) : { x: 1, y: 0 };
        const invA = 1 / a.mass;
        const invB = 1 / b.mass;
        const penetration = (contact - gap) / (invA + invB);
        a.x -= normal.x * penetration * invA;
        a.y -= normal.y * penetration * invA;
        b.x += normal.x * penetration * invB;
        b.y += normal.y * penetration * invB;
        const speed = (a.vx - b.vx) * normal.x + (a.vy - b.vy) * normal.y;
        if (speed <= 0) return;
        const bounce = Math.min(materials[a.tier].bounce, materials[b.tier].bounce);
        const impulse = (speed * (1 + bounce)) / (invA + invB);
        a.vx -= impulse * invA * normal.x;
        a.vy -= impulse * invA * normal.y;
        b.vx += impulse * invB * normal.x;
        b.vy += impulse * invB * normal.y;
        if (speed >= minimumImpact && (a.depth || b.depth)) {
            const depth = Math.max(a.depth, b.depth) + 1;
            a.depth = depth;
            b.depth = depth;
            registerImpact(depth);
            crack(a, depth, -normal.x, -normal.y);
            crack(b, depth, normal.x, normal.y);
            if (depth >= 3) state.message = depth + '연쇄! 파편이 흩어졌어요.';
        }
    }

    function gather(dt) {
        const sought = new Set();
        for (const rival of rivals) {
            const nearest = state.shards
                .filter((shard) => !sought.has(shard) && state.nowMs >= shard.landsAt)
                .sort((a, b) => distance(rival, a) - distance(rival, b))[0];
            if (!nearest) continue;
            sought.add(nearest);
            const dir = unit(nearest.x - rival.x, nearest.y - rival.y);
            const travel = Math.min(rivalSpeed * dt, Math.max(0, distance(rival, nearest) - 9));
            actorMove(rival, dir.x * travel, dir.y * travel);
        }
        state.shards = state.shards.filter((shard) => {
            const decay = Math.exp(-5.5 * dt);
            shard.x = clamp(shard.x + shard.vx * dt, 8, width - 8);
            shard.y = clamp(shard.y + shard.vy * dt, 8, height - 8);
            shard.vx *= decay;
            shard.vy *= decay;
            shard.locked = state.nowMs < shard.opensAt;
            if (state.nowMs < shard.landsAt) return true;
            const eligible = shard.locked ? [player] : [player, ...rivals];
            const winner = eligible
                .filter((actor) => distance(actor, shard) <= actor.r + 13)
                .sort((a, b) => distance(a, shard) - distance(b, shard))[0];
            if (!winner) return true;
            winner.loot++;
            effect('collect', shard.x, shard.y, shard.tier);
            if (winner !== player) state.message = '경쟁자가 열린 파편 하나를 먼저 주웠어요.';
            if (winner === player && player.loot >= 4 && !state.level) {
                state.level = 1;
                state.message = '청석 곡갱이로 강화! 이제 광석을 더 멀리 날려요.';
            }
            return false;
        });
    }

    function step({ x = 0, y = 0, destination = null } = {}) {
        state.nowMs += tickMs;
        const dt = tickMs / 1000;
        for (const e of state.effects) e.ageMs += tickMs;
        state.effects = state.effects.filter((e) => e.ageMs < 710);
        const ore = targetOre();
        const movingWithKeys = x !== 0 || y !== 0;
        const target = movingWithKeys ? null : (ore ?? destination);
        const range = ore ? swingRange - 12 : 5;
        if (target && distance(player, target) > range) {
            x = target.x - player.x;
            y = target.y - player.y;
        }
        const direction = unit(x, y);
        if (direction.x || direction.y) {
            player.faceX = direction.x;
            player.faceY = direction.y;
            actorMove(player, direction.x * playerSpeed * dt, direction.y * playerSpeed * dt);
        }
        advanceRequest();
        player.swing = Math.max(0, (swingUntil - state.nowMs) / 230);
        for (const ore of ores) if (ore.hp > 0) moveOre(ore, dt);
        for (let i = 0; i < ores.length; i++) {
            if (ores[i].hp <= 0) continue;
            for (let j = i + 1; j < ores.length && ores[i].hp > 0; j++) {
                if (ores[j].hp > 0) collide(ores[i], ores[j]);
            }
        }
        gather(dt);
    }

    function snapshot() {
        return { ...state, ores: ores.filter((ore) => ore.hp > 0) };
    }

    return { step, snapshot, command, oreAt };
}
