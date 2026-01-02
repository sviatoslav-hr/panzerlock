import type {Rect} from '#/math';
import {Direction, getDirectionAngle} from '#/math/direction';
import {Duration} from '#/math/duration';
import type {Renderer} from '#/renderer';
import {Sprite} from '#/renderer/sprite';

const tankKinds = ['light', 'medium', 'heavy'] as const;
export type TankKind = (typeof tankKinds)[number];

export interface TankSchema {
    turret: TankKind;
    body: TankKind;
    damage: number;
    reloadTime: Duration;
    maxHealth: number;
    maxSpeed: number;
    topSpeedReachTime: Duration;
}

export function makeTankSchema(bot: boolean, kind: TankKind): TankSchema {
    if (bot) {
        return {
            turret: kind,
            body: kind,
            damage: tankAttributes.damageEnemy[kind],
            reloadTime: Duration.milliseconds(tankAttributes.reloadMillisEnemy[kind]),
            maxHealth: tankAttributes.maxHealthEnemy[kind],
            maxSpeed: tankAttributes.topSpeedEnemy[kind],
            topSpeedReachTime: Duration.milliseconds(tankAttributes.topSpeedReachMillisEnemy),
        };
    }
    assert(kind === 'medium', 'Player tanks are always medium kind');
    return {
        turret: kind,
        body: kind,
        damage: tankAttributes.damagePlayer,
        reloadTime: Duration.milliseconds(tankAttributes.reloadMillisPlayer),
        maxHealth: tankAttributes.maxHealthPlayer,
        maxSpeed: tankAttributes.topSpeedPlayer,
        topSpeedReachTime: Duration.milliseconds(tankAttributes.topSpeedReachMillisPlayer),
    };
}

export const RESTORE_HP_AMOUNT = 200; // full hp
export const SPEED_INCREASE_MULT = 0.1; // 10% speed increase per power-up
export const RELOAD_INCREASE_MULT = 0.15; // 10% reload time decrease per power-up
export const SHIELD_MAX_CHARGES = 6;
export const SHIELD_PICKUP_CHARGES = 2;
export const SHIELD_PICKUP_DURATION = Duration.milliseconds(10000);
export const SHIELD_SPAWN_DURATION = Duration.milliseconds(1500);

interface TankAttributes {
    maxHealthEnemy: Record<TankKind, number>;
    maxHealthPlayer: number;
    topSpeedEnemy: Record<TankKind, number>;
    topSpeedPlayer: number;
    topSpeedReachMillisEnemy: number;
    topSpeedReachMillisPlayer: number;
    damageEnemy: Record<TankKind, number>;
    damagePlayer: number;
    reloadMillisEnemy: Record<TankKind, number>;
    reloadMillisPlayer: number;
}

// NOTE: Attributes are picked so that:
// - For a player it takes N hits to kill:
// 2 for light enemy, 3 for medium enemy, 4-5 for heavy enemy
// - For an enemy it takes M hits to kill player:
// 4 for light enemy, 3 for medium enemy, 2 for heavy enemy
const tankAttributes: TankAttributes = {
    maxHealthEnemy: {
        light: 40,
        medium: 100,
        heavy: 160,
    },
    maxHealthPlayer: 100,
    topSpeedEnemy: {
        light: (360 * 1000) / (60 * 60), // in m/s
        medium: (300 * 1000) / (60 * 60),
        heavy: (240 * 1000) / (60 * 60),
    },
    // NOTE: Player should be faster because the game feel better this way.
    topSpeedPlayer: (450 * 1000) / (60 * 60),
    topSpeedReachMillisEnemy: 150,
    topSpeedReachMillisPlayer: 50,
    damageEnemy: {
        light: 25,
        medium: 35,
        heavy: 50,
    },
    damagePlayer: 37,
    reloadMillisEnemy: {
        light: 1000,
        medium: 1500,
        heavy: 2500,
    },
    reloadMillisPlayer: 1200,
};

function makeTankTurretSprite(keyPrefix: string, kind: TankKind): Sprite<'static'> {
    switch (kind) {
        case 'light':
            return new Sprite({
                key: `${keyPrefix}_turret_${kind}`,
                frameWidth: 44,
                frameHeight: 68,
                framePadding: 3,
                states: [{name: 'static', frames: 1}],
            });
        case 'medium':
            return new Sprite({
                key: `${keyPrefix}_turret_${kind}`,
                frameWidth: 42,
                frameHeight: 72,
                framePadding: 3,
                states: [{name: 'static', frames: 1}],
            });
        case 'heavy':
            return new Sprite({
                key: `${keyPrefix}_turret_${kind}`,
                frameWidth: 48,
                frameHeight: 83,
                framePadding: 3,
                states: [{name: 'static', frames: 1}],
            });
    }
}

function makeTankBodySprite(keyPrefix: string, kind: TankKind, bot: boolean): Sprite<'moving'> {
    return new Sprite({
        key: `${keyPrefix}_body_${kind}`,
        frameWidth: 64,
        frameHeight: 64,
        framePadding: 3,
        // HACK: Tracks animation speed should be dependent by the speed of the tank.
        frameDuration: Duration.milliseconds(bot ? 60 : 40),
        states: [{name: 'moving', frames: 6}],
    });
}

const turretYOffsets: Record<TankKind, number> = {
    light: 10,
    medium: 11,
    heavy: 8,
};

export function createTankSpriteGroup(bot: boolean, schema: TankSchema): TankSpriteGroup {
    const keyPrefix = bot ? 'tank_darkgray' : 'tank_green';
    const turret = makeTankTurretSprite(keyPrefix, schema.turret);
    const body = makeTankBodySprite(keyPrefix, schema.body, bot);
    return new TankSpriteGroup(turret, body, schema);
}

export class TankSpriteGroup {
    constructor(
        readonly turret: Sprite<'static'>,
        readonly body: Sprite<'moving'>,
        readonly schema: TankSchema,
    ) {}

    draw(renderer: Renderer, boundary: Rect, direction: Direction): void {
        const directionAngle = getDirectionAngle(direction);
        // FIXME: Sprites look better (not blurry) when smoothing is disabled,
        //        but is also causes jittering on big screens. (Not sure how to fix it yet)
        if (renderer.imageSmoothingDisabled) renderer.ctx.imageSmoothingEnabled = false;
        this.body.draw(renderer, boundary, directionAngle - 180);
        {
            const turret = this.turret;
            const bodyHeight = this.body.frameHeight - this.body.framePadding * 2;
            const sizeRatio = bodyHeight / boundary.height;
            const turretYOffset = turretYOffsets[this.schema.turret] / sizeRatio;
            const turretWidth = (turret.frameWidth - turret.framePadding * 2) / sizeRatio;
            const turretHeight = (turret.frameHeight - turret.framePadding * 2) / sizeRatio;
            const wDiff = boundary.width - turretWidth;
            const cx = boundary.x + boundary.width / 2;
            const cy = boundary.y + boundary.height / 2;
            // NOTE: We need to rotate the turret around the center of the tank body
            //       because it's being offset from the center of the tank.
            const spriteBoundary = rotateRectAround(
                {
                    x: boundary.x + wDiff / 2,
                    y: boundary.y + turretYOffset,
                    width: turretWidth,
                    height: turretHeight,
                },
                cx,
                cy,
                directionAngle - 180,
            );
            this.turret.draw(renderer, spriteBoundary, directionAngle - 180);
        }
        if (renderer.imageSmoothingDisabled) renderer.ctx.imageSmoothingEnabled = true;
    }

    update(dt: Duration): void {
        this.body.update(dt);
    }
}

function rotateRectAround(rect: Rect, cx: number, cy: number, angle: number) {
    angle = ((angle % 360) + 360) % 360; // Normalize angle

    let {x, y, width, height} = rect;

    const dx = x - cx;
    const dy = y - cy;

    switch (angle) {
        case 0:
            return {x, y, width, height};
        case 90:
            return {
                x: cx - dy - height,
                y: cy + dx,
                width: height,
                height: width,
            };
        case 180:
            return {
                x: cx - dx - width,
                y: cy - dy - height,
                width,
                height,
            };
        case 270:
            return {
                x: cx + dy,
                y: cy - dx - width,
                width: height,
                height: width,
            };
        default:
            throw new Error('Only angles 0, 90, 180, 270 are supported');
    }
}
