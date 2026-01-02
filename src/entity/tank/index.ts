import {Animation, easeOut} from '#/animation';
import {CELL_SIZE} from '#/const';
import {Entity} from '#/entity/core';
import {newEntityId} from '#/entity/id';
import {
    createTankSpriteGroup,
    makeTankSchema,
    TankKind,
    TankSchema,
    TankSpriteGroup,
} from '#/entity/tank/generation';
import {Rect} from '#/math';
import {Direction} from '#/math/direction';
import {Duration} from '#/math/duration';
import {Vector2Like} from '#/math/vector';
import {createShieldSprite, Sprite} from '#/renderer/sprite';

export function isPlayerTank(tank: Tank): tank is PlayerTank {
    return !tank.bot;
}

export function isEnemyTank(tank: Tank): tank is EnemyTank {
    return tank.bot;
}

export abstract class Tank extends Entity {
    abstract readonly bot: boolean;
    readonly id = newEntityId();
    x = 0;
    y = 0;
    width = CELL_SIZE * 0.8;
    height = CELL_SIZE * 0.8;
    dead = true;
    direction = Direction.NORTH;
    aliveForMs = 0;

    velocity = 0;
    lastAcceleration = 0;
    moving = false;
    collided = false;
    speedMult = 1;
    damageIncreasedTimes = 0;
    reloadMult = 1;

    shieldTimer = Duration.zero();
    shieldChangesCount = 0;
    shootingDelay = Duration.milliseconds(0);
    prevHealth = 0;
    healthAnimation = new Animation(Duration.milliseconds(500), easeOut).end();

    readonly shieldBoundary: Rect = {
        x: this.x - this.width / 2,
        y: this.y - this.height / 2,
        width: this.width * 2,
        height: this.height * 2,
    };
    abstract readonly shieldSprite: Sprite<string>;
    abstract sprite: TankSpriteGroup;
    abstract schema: TankSchema;

    get cx(): number {
        return this.x + this.width / 2;
    }

    get cy(): number {
        return this.y + this.height / 2;
    }

    get needsHealing(): boolean {
        return this.health < this.schema.maxHealth;
    }

    get hasShield(): boolean {
        return this.shieldChangesCount > 0 || this.shieldTimer.positive;
    }

    get isShieldBreakable(): boolean {
        return !this.shieldTimer.positive;
    }

    changeKind(kind: TankKind): void {
        const schema = makeTankSchema(this.bot, kind);
        this.schema = schema;
        this.sprite = createTankSpriteGroup(this.bot, schema);
    }
}

export class EnemyTank extends Tank implements Entity {
    readonly bot = true;
    schema = makeTankSchema(this.bot, 'medium');
    sprite = createTankSpriteGroup(this.bot, this.schema);
    shieldSprite = createShieldSprite('enemy');

    shouldRespawn = false;
    moving = true;
    targetPath: Vector2Like[] = [];
    spawnFreezeTimer = Duration.zero();
    pathfindDelay = Duration.zero();
    pathfindRestartDelay = Duration.zero();
}

export class PlayerTank extends Tank implements Entity {
    readonly bot = false;
    readonly schema = makeTankSchema(this.bot, 'medium');
    readonly sprite = createTankSpriteGroup(this.bot, this.schema);
    readonly shieldSprite = createShieldSprite('player');

    dead = true;
    invincible = false;
    // TODO: This field shouldn't exist here, it should somewhere in the score layer, probably.
    survivedFor = Duration.zero();
    // HACK: This field is used as a flag to indicate that the game is completed.
    //       It should be removed once `survivedFor` will be moved out of this class.
    completedGame = false;
}
