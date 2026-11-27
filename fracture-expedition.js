const passageRadius = 34;
export const expeditionGoldSector = { x: 50, y: 26 };
export const goldLodeLocal = { x: 430, y: 325 };
export const goldSuppliesLocal = {
    stone: { x: 280, y: 205 },
    copper: { x: 390, y: 205 },
    iron: { x: 507, y: 205 },
};
export const upperGoldSector = { x: 51, y: 26 };
export const upperGoldLocal = { x: 181, y: 177 };
export const goldRouteThreshold = 25;
export const restCampLocal = { x: 110, y: 518 };

export function createExpedition(sector, center, online) {
    const point = (x, y, sy) =>
        online ? { x: center.x + x, y: sector.height * sy + y } : { x, y };
    const gold = point(goldLodeLocal.x, goldLodeLocal.y, expeditionGoldSector.y);
    const upperGold = online
        ? {
              x: upperGoldSector.x * sector.width + upperGoldLocal.x,
              y: upperGoldSector.y * sector.height + upperGoldLocal.y,
          }
        : upperGoldLocal;
    const restCamp = online
        ? {
              x: upperGoldSector.x * sector.width + restCampLocal.x,
              y: upperGoldSector.y * sector.height + restCampLocal.y,
          }
        : restCampLocal;
    const passages = online
        ? [
              {
                  ...point(676, 489, 3),
                  label: '황금 협곡 통로',
                  radius: passageRadius,
                  level: 3,
                  exit: point(235, 461, expeditionGoldSector.y),
              },
              {
                  ...point(665, 178, expeditionGoldSector.y),
                  label: '대광맥 통로',
                  radius: passageRadius,
                  level: 4,
                  exit: { x: center.x - 269, y: center.y + 285 },
              },
              {
                  x: center.x + 340,
                  y: center.y + 426,
                  label: '귀환 통로',
                  radius: passageRadius,
                  level: 5,
                  exit: restCamp,
              },
          ]
        : [];

    return {
        passages,
        objective(player, level, goldHeld = 0, neededSupply) {
            if (level < 3) return null;
            let goal;
            if (level >= 5) {
                goal =
                    online && player.y > center.y - 1250
                        ? { ...passages[2], kind: 'passage' }
                        : { ...restCamp, label: '귀환 캠프 · 원정 완주', kind: 'lode' };
            } else if (online && player.y < gold.y - sector.height * 2) {
                goal = { ...passages[0], kind: 'passage' };
            } else if (level >= 4) {
                goal =
                    !online || player.y > center.y - 1250
                        ? { ...center, label: '대광맥', kind: 'boss' }
                        : { ...passages[1], kind: 'passage' };
            } else if (online && neededSupply) {
                const { x, y, label } = neededSupply;
                goal = { ...point(x, y, expeditionGoldSector.y), label, kind: 'lode' };
            } else if (
                online &&
                goldHeld >= goldRouteThreshold &&
                goldHeld < goldRouteThreshold * 2
            ) {
                goal = { ...upperGold, label: '새벽 금맥', kind: 'lode' };
            } else {
                goal = { ...gold, label: '황금 협곡', kind: 'lode' };
            }
            return {
                x: goal.x,
                y: goal.y,
                label: goal.label,
                kind: goal.kind,
                completed: level >= 5,
                passages: passages.map(({ x, y, label, radius, level: required }) => ({
                    x,
                    y,
                    label,
                    radius,
                    open: level >= required,
                })),
            };
        },
    };
}
