import type {Rect} from '#/math';
import {Direction, getDirectionAngle} from '#/math/direction';
import {Duration} from '#/math/duration';
import type {Renderer} from '#/renderer';
import {Sprite} from '#/renderer/sprite';

const tankKinds = ['light', 'medium', 'heavy'] as const;
export type TankKind = (typeof tankKinds)[number];

export interface TankSchema {
    kind: TankKind;
    damage: number;
    reloadTime: Duration;
    maxHealth: number;
    maxSpeed: number;
    maxSpeedReachTime: Duration;
}

export function makeTankSchema(bot: boolean, kind: TankKind): TankSchema {
    if (bot) {
        const specs = specsGroup.enemy[kind];
        assert(kind === specs.kind, 'Enemy schema kind must match');
        return specs;
    }
    const specs = specsGroup.player;
    assert(kind === specs.kind, 'Player tanks are always medium kind');
    return specs;
}

export const RESTORE_HP_AMOUNT = 200; // full hp
export const SPEED_INCREASE_MULT = 0.1; // 10% speed increase per power-up
export const RELOAD_INCREASE_MULT = 0.15; // 10% reload time decrease per power-up
export const SHIELD_MAX_CHARGES = 6;
export const SHIELD_PICKUP_CHARGES = 2;
export const DAMAGE_PICKUP_MULT = 0.3; // 30% damage increase with each pickup
export const SHIELD_PICKUP_DURATION = Duration.milliseconds(10000);
export const SHIELD_SPAWN_DURATION = Duration.milliseconds(1500);

interface TankSchemaGroup {
    player: TankSchema;
    enemy: Record<TankKind, TankSchema>;
}

// NOTE: Attributes are picked so that:
// - For a player it takes N hits to kill:
// 2 for light enemy, 3 for medium enemy, 4-5 for heavy enemy
// - For an enemy it takes M hits to kill player:
// 4 for light enemy, 3 for medium enemy, 2 for heavy enemy
const specsGroup: TankSchemaGroup = {
    player: {
        kind: 'medium',
        maxHealth: 50,
        damage: 12,
        reloadTime: Duration.milliseconds(1200),
        // NOTE: Player should be faster because the game feel better this way.
        maxSpeed: (450 * 1000) / (60 * 60), // in m/s
        maxSpeedReachTime: Duration.milliseconds(50),
    },
    enemy: {
        light: {
            kind: 'light',
            maxHealth: 30,
            damage: 10,
            reloadTime: Duration.milliseconds(1000),
            maxSpeed: (360 * 1000) / (60 * 60),
            maxSpeedReachTime: Duration.milliseconds(150),
        },
        medium: {
            kind: 'medium',
            maxHealth: 50,
            damage: 17,
            reloadTime: Duration.milliseconds(1500),
            maxSpeed: (300 * 1000) / (60 * 60),
            maxSpeedReachTime: Duration.milliseconds(150),
        },
        heavy: {
            kind: 'heavy',
            maxHealth: 80,
            damage: 25,
            reloadTime: Duration.milliseconds(2500),
            maxSpeed: (240 * 1000) / (60 * 60),
            maxSpeedReachTime: Duration.milliseconds(150),
        },
    },
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
    const turret = makeTankTurretSprite(keyPrefix, schema.kind);
    const body = makeTankBodySprite(keyPrefix, schema.kind, bot);
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
            const turretYOffset = turretYOffsets[this.schema.kind] / sizeRatio;
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
