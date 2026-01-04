import {CELL_SIZE} from '#/const';
import {Entity, findIntersectingAmong, isIntesecting} from '#/entity/core';
import {type Tank} from '#/entity/tank';
import {
    RELOAD_INCREASE_MULT,
    RESTORE_HP_AMOUNT,
    SHIELD_PICKUP_CHARGES,
    SPEED_INCREASE_MULT,
} from '#/entity/tank/generation';
import {activateTankShield, restoreTankHealth} from '#/entity/tank/simulation';
import {Rect, scaleRectCentered} from '#/math';
import type {Duration} from '#/math/duration';
import {random} from '#/math/rng';
import type {Renderer} from '#/renderer';
import {Sprite} from '#/renderer/sprite';
import type {GameState} from '#/state';
import type {Room} from '#/world/room';

export const PickupType = {
    REPAIR: 'repair',
    RELOAD_BOOST: 'reload-boost',
    SHIELD: 'shield',
    DAMAGE_BOOST: 'damage-boost',
    SPEED_BOOST: 'speed-boost',
} as const;
export type PickupType = (typeof PickupType)[keyof typeof PickupType];

const allPickupTypes = [
    PickupType.REPAIR,
    PickupType.RELOAD_BOOST,
    PickupType.SHIELD,
    PickupType.DAMAGE_BOOST,
    PickupType.SPEED_BOOST,
];

const PICKUP_SIZE = CELL_SIZE * 0.5;
const PICKUP_SPRITE_SCALE = 0.7;

export class Pickup extends Entity {
    readonly type: PickupType;
    readonly sprite: Sprite<string>;
    readonly spriteRect: Rect;
    readonly frameIndex: number;
    readonly animationPulseSize = random.int32Range(100, 200);
    aliveForMs = 0;

    constructor(type: PickupType, x: number, y: number) {
        super();
        this.type = type;
        this.dead = false; // NOTE: Basically alias for "collected" state.
        this.x = x;
        this.y = y;
        this.width = PICKUP_SIZE;
        this.height = PICKUP_SIZE;
        this.spriteRect = scaleRectCentered(this, PICKUP_SPRITE_SCALE);
        this.sprite = new Sprite({
            key: 'pickups',
            frameWidth: 275,
            frameHeight: 275,
            states: [{name: 'anim', frames: allPickupTypes.length}],
        });
        this.frameIndex = allPickupTypes.findIndex((t) => t === type);
        this.sprite.selectFrame(this.frameIndex);
    }
}
const pickupColors: Record<PickupType, string> = {
    [PickupType.REPAIR]: '#00ff00',
    [PickupType.SHIELD]: '#00ffff',
    [PickupType.SPEED_BOOST]: '#ffffff',
    [PickupType.DAMAGE_BOOST]: '#ff0000',
    [PickupType.RELOAD_BOOST]: '#ffc107',
};

export function drawPickups(renderer: Renderer, pickups: Pickup[]): void {
    const bgOpacity = Math.floor(0.33 * 255).toString(16);
    for (const pickup of pickups) {
        if (pickup.dead) continue;
        const pulseSize = pickup.animationPulseSize;
        const alpha = (Math.sin(pickup.aliveForMs / pulseSize) + 1) / 2 / 3 + 0.66;
        renderer.setGlobalAlpha(alpha);
        {
            const color = pickupColors[pickup.type];
            renderer.setFillColor(color + bgOpacity);
            renderer.fillRect2(pickup);
            renderer.setStrokeColor(color);
            renderer.strokeBoundary(pickup, 2);
            pickup.sprite.draw(renderer, pickup.spriteRect);
        }
        renderer.setGlobalAlpha(1);
    }
}

export function simulatePickups(dt: Duration, state: GameState): void {
    const room = state.world.activeRoom;
    for (const pickup of room.pickups) {
        if (pickup.dead) continue;
        pickup.aliveForMs += dt.milliseconds;
    }

    // NOTE: Iterate through all pickups in the room and apply them to the player.
    for (const tank of state.tanks) {
        if (tank.dead) continue;
        for (const pickup of room.pickups) {
            if (pickup.dead) continue;
            if (isIntesecting(pickup, tank)) {
                applyPickup(pickup, tank);
                break;
            }
        }
    }
}

function applyPickup(pickup: Pickup, tank: Tank): void {
    assert(!tank.dead);
    let skipped = false;
    switch (pickup.type) {
        case PickupType.REPAIR: {
            const repairUsed = restoreTankHealth(tank, RESTORE_HP_AMOUNT);
            skipped = !repairUsed;
            break;
        }
        case PickupType.SHIELD: {
            const chargeUsed = activateTankShield(tank, SHIELD_PICKUP_CHARGES);
            skipped = !chargeUsed;
            break;
        }
        case PickupType.SPEED_BOOST:
            tank.speedMult += SPEED_INCREASE_MULT;
            break;
        case PickupType.DAMAGE_BOOST:
            tank.damageIncreasedTimes += 1; // DAMAGE_INCREASE_MULT;
            break;
        case PickupType.RELOAD_BOOST:
            tank.reloadMult += RELOAD_INCREASE_MULT;
            break;

        default:
            assert(false);
    }
    if (!skipped) pickup.dead = true;
}

export function generatePickups(room: Room, state: GameState): void {
    // NOTE: Offset by one cell from the edge to prevent immediate intersection other entities on spawn.
    const minX = room.boundary.x + CELL_SIZE * 2;
    const minY = room.boundary.y + CELL_SIZE * 2;
    const maxX = room.boundary.x + room.boundary.width - CELL_SIZE * 2;
    const maxY = room.boundary.y + room.boundary.height - CELL_SIZE * 2;
    const minXRel = minX / CELL_SIZE;
    const minYRel = minY / CELL_SIZE;
    const maxXRel = maxX / CELL_SIZE;
    const maxYRel = maxY / CELL_SIZE;

    // const selectedPickups = random.selectMany(allPickupTypes, 2, 4).concat(PickupType.SHIELD);
    // const selectedPickups = allPickupTypes.slice();
    const selectedPickups = getPickupsForRoom(room);

    let pickupType: PickupType | undefined;
    const offset = (CELL_SIZE - PICKUP_SIZE) / 2;
    const testRect: Rect = {x: 0, y: 0, width: PICKUP_SIZE, height: PICKUP_SIZE};
    // TODO: Add iterations limit to prevent infinite loops.
    while ((pickupType = selectedPickups[0])) {
        // Use relative positions to place pickups exactly in the grid.
        const xRel = random.int32Range(minXRel, maxXRel);
        const yRel = random.int32Range(minYRel, maxYRel);
        testRect.x = xRel * CELL_SIZE + offset;
        testRect.y = yRel * CELL_SIZE + offset;

        if (isIntesecting(testRect, state.player)) continue;
        if (findIntersectingAmong(testRect, room.blocks)) continue;
        if (findIntersectingAmong(testRect, room.pickups)) continue;

        const pickup = new Pickup(pickupType, testRect.x, testRect.y);
        room.pickups.push(pickup);
        selectedPickups.shift();
    }
}

function getPickupsForRoom(room: Room): PickupType[] {
    const level = room.wave.level;
    const randomPickupsPool = level.pickups?.random?.types ?? allPickupTypes;
    const minPickups = level.pickups?.random?.count ?? 2;
    const maxPickups = level.pickups?.random?.count ?? 4;
    const selectedPickups = random.selectMany(randomPickupsPool, minPickups, maxPickups);
    if (level.pickups?.forced) {
        selectedPickups.push(...level.pickups?.forced);
    }
    return unique(selectedPickups);
}

function unique<TItem>(arr: TItem[]): TItem[] {
    return [...new Set(arr)];
}
