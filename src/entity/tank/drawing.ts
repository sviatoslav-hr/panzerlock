import {Color} from '#/color';
import {CELL_SIZE} from '#/const';
import {EnemyTank, isEnemyTank, isPlayerTank, PlayerTank, Tank} from '#/entity/tank';
import {SHIELD_MAX_CHARGES} from '#/entity/tank/generation';
import {Renderer} from '#/renderer';
import {roomSizeInCells} from '#/world/room';

export function drawAllTankModels(renderer: Renderer, tanks: Tank[]): void {
    for (const tank of tanks) {
        if (tank.dead) continue;
        const freezed = isEnemyTank(tank) && tank.spawnFreezeTimer.positive;
        if (freezed) renderer.setGlobalAlpha(0.5);
        tank.sprite.draw(renderer, tank, tank.direction);
        if (tank.hasShield) {
            tank.shieldSprite.draw(renderer, tank.shieldBoundary);
        }
        if (freezed) renderer.setGlobalAlpha(1);
    }
}

export function drawTanksFloatUI(renderer: Renderer, tanks: Tank[]): void {
    for (const tank of tanks) {
        // NOTE: Draw health bar animation even if dead for dramatic effect.
        // NOTE: Draw hp bar only if the tank is not full health.
        let yOffset = -FLOAT_BAR_Y_OFFSET / renderer.camera.scale;
        // NOTE: Only draw shield if its not timer based to hint that it's not breakable.
        if (!tank.dead && tank.shieldChangesCount && !tank.shieldTimer.positive) {
            yOffset += drawTankShieldFloatBar(renderer, tank, yOffset) - tank.y;
        }
        if (tank.healthAnimation.active || !tank.dead) {
            yOffset += drawTankHealthFloatBar(renderer, tank, yOffset) - tank.y;
        }
    }
}

export function drawPlayerTankUI(renderer: Renderer, tank: PlayerTank): void {
    if (!tank.dead || tank.healthAnimation.active) {
        drawPlayerHealthBar(renderer, tank);
    }
    if (!tank.dead) {
        drawPlayerShootingBar(renderer, tank);
    }
}

export function drawAllTanksDevUI(renderer: Renderer, tanks: Tank[]): void {
    for (const tank of tanks) {
        if (tank.dead) continue;
        drawTankDevBoundary(renderer, tank);
        if (isEnemyTank(tank)) {
            // if (this.collisionAnimation.active) {
            //     renderer.setStrokeColor(Color.WHITE_NAVAJO);
            //     renderer.strokeBoundary(this, this.collisionAnimation.progress * 10);
            // }
            if (tank.collided) {
                renderer.setStrokeColor(Color.RED);
                renderer.strokeBoundary(tank, 1);
            }
            drawEnemyDevTargetPath(renderer, tank);
            // NOTE: It only makes sense to draw the shooting bar for bots for debug purposes
            drawTankDevShootingBarAbove(renderer, tank);
        }
    }
}

function getTankHealthFractionAnimated(tank: Tank): number {
    const fromHealth = tank.prevHealth;
    const toHealth = tank.health;
    let animatedHpFraction = toHealth / tank.schema.maxHealth || 0;
    if (!tank.healthAnimation.finished) {
        const healthDiff = toHealth - fromHealth;
        const animatedHealth = fromHealth + healthDiff * tank.healthAnimation.progress;
        animatedHpFraction = animatedHealth / tank.schema.maxHealth || 0;
    }
    return animatedHpFraction;
}

const FLOAT_BAR_HEIGHT = 3;
const FLOAT_BAR_Y_OFFSET = 6;
const FLOAT_BAR_Y_PADDING = 3;
const FLOAT_BAR_WIDTH_SCALE = 0.9;
const FLOAT_BAR_CHUNK_PADDING_SCALE = 0.02;

function drawTankHealthFloatBar(renderer: Renderer, tank: Tank, offsetY = 0): number {
    const value = getTankHealthFractionAnimated(tank);
    if (tank.healthAnimation.finished && tank.health === tank.schema.maxHealth) {
        renderer.setGlobalAlpha(0.1);
    }
    const HP_BAR_CHUNK_SIZE = 10;
    const hpBarChunks = Math.ceil(tank.schema.maxHealth / HP_BAR_CHUNK_SIZE);
    const endX = drawTankFloatBar(
        renderer,
        tank,
        value,
        hpBarChunks,
        Color.GREEN,
        Color.GREEN_DARKEST,
        offsetY,
    );
    renderer.setGlobalAlpha(1);
    return endX;
}

function drawTankShieldFloatBar(renderer: Renderer, tank: Tank, offsetY = 0): number {
    const value = tank.shieldChangesCount / SHIELD_MAX_CHARGES || 0;
    renderer.setGlobalAlpha(0.7);
    const endX = drawTankFloatBar(
        renderer,
        tank,
        value,
        SHIELD_MAX_CHARGES,
        Color.BLUE_PRIMARY,
        Color.BLUE_DARKEST,
        offsetY,
    );
    renderer.setGlobalAlpha(1);
    return endX;
}

function drawTankFloatBar(
    renderer: Renderer,
    tank: Tank,
    value: number,
    maxChunksCount: number,
    fgColor: string,
    bgColor: string,
    offsetY = 0,
): number {
    assert(value >= 0 && value <= 1);
    const barWidth = tank.width * FLOAT_BAR_WIDTH_SCALE;
    // NOTE: Draw health bar in camera size, since it's a UI element and it should not scale.
    const barHeight = FLOAT_BAR_HEIGHT / renderer.camera.scale;
    const barYOffset = FLOAT_BAR_Y_PADDING / renderer.camera.scale;
    const chunkPadding = barWidth * FLOAT_BAR_CHUNK_PADDING_SCALE;
    const barY = tank.y - barHeight - barYOffset + offsetY;
    const barX = tank.x + (tank.width - barWidth) / 2;

    const chunksCount = Math.ceil(value / (1 / maxChunksCount));
    const totalChunksWidth = barWidth - chunkPadding * (chunksCount - 1);
    const chunkMaxWidth = totalChunksWidth / maxChunksCount;
    const fractionPerChunk = 1 / maxChunksCount;
    let chunkWidthSum = 0;
    for (let i = 0; i < maxChunksCount; i++) {
        const chunkX = barX + i * (chunkMaxWidth + chunkPadding);
        const chunkFractionStart = fractionPerChunk * i;
        const chunkFractionEndMax = fractionPerChunk * (i + 1);
        // 0..chunkFractionSize
        let chunkFraction = Math.max(0, Math.min(value, chunkFractionEndMax) - chunkFractionStart);
        // 0..1
        chunkFraction = Math.min(1, chunkFraction * maxChunksCount);
        assert(chunkFraction >= 0);
        let chunkWidth = chunkMaxWidth;
        if (chunkFraction < 1) {
            renderer.setFillColor(bgColor);
            renderer.fillRect(chunkX, barY, chunkWidth, barHeight);
        }
        chunkWidthSum += chunkWidth * chunkFraction;
        renderer.setFillColor(fgColor);
        renderer.fillRect(chunkX, barY, chunkWidth * chunkFraction, barHeight);
    }
    renderer.setGlobalAlpha(1);
    return barY + barHeight;
}

function drawPlayerHealthBar(renderer: Renderer, player: PlayerTank): void {
    // TODO: Refactor these draw methods to be more flexible and configurable.
    renderer.useCameraCoords(true);
    renderer.setGlobalAlpha(0.6);
    const barWidth = 20;
    const paddingX = 5;
    const paddingY = 10;
    const barHeight = Math.min(
        renderer.canvas.height - paddingY * 2,
        (roomSizeInCells.height + 2) * CELL_SIZE * renderer.camera.scale,
    );
    const barY = (renderer.canvas.height - barHeight) / 2;
    const barX = paddingX;

    const animatedHpFraction = getTankHealthFractionAnimated(player);

    {
        const bgBarHeight = barHeight * (1 - animatedHpFraction);
        renderer.setFillColor(Color.GREEN_DARKEST);
        renderer.fillRect(barX, barY, barWidth, bgBarHeight);
    }
    if (animatedHpFraction > 0) {
        renderer.setFillColor(Color.GREEN);
        const hpBarHeight = barHeight * animatedHpFraction;
        const greenBarY = barY + barHeight - hpBarHeight;
        renderer.fillRect(barX, greenBarY, barWidth, hpBarHeight);
    }
    renderer.setGlobalAlpha(1);
    renderer.setStrokeColor(Color.GREEN);
    renderer.strokeBoundary2(barX, barY, barWidth, barHeight);
    renderer.useCameraCoords(false);
}

function drawPlayerShootingBar(renderer: Renderer, player: Tank): void {
    assert(isPlayerTank(player));
    renderer.useCameraCoords(true);
    renderer.setGlobalAlpha(0.8);
    const reloadTime = player.schema.reloadTime.milliseconds / player.reloadMult;
    const fraction = 1 - player.shootingDelay.milliseconds / reloadTime;
    const barWidth = 20;
    const paddingX = 5;
    const paddingY = 10;
    const barHeight = Math.min(
        renderer.canvas.height - paddingY * 2,
        (roomSizeInCells.height + 2) * CELL_SIZE * renderer.camera.scale,
    );
    const barY = (renderer.canvas.height - barHeight) / 2;
    const barX = renderer.canvas.width - paddingX - barWidth;
    {
        renderer.setFillColor('#493909');
        renderer.fillRect(barX, barY, barWidth, barHeight * (1 - fraction));
    }
    const color = '#ffc107';
    {
        renderer.setFillColor(color);
        renderer.fillRect(barX, barY + barHeight * (1 - fraction), barWidth, barHeight * fraction);
    }
    renderer.setGlobalAlpha(1);
    renderer.setStrokeColor(color);
    renderer.strokeBoundary2(barX, barY, barWidth, barHeight);
    renderer.useCameraCoords(false);
}

function drawTankDevShootingBarAbove(renderer: Renderer, tank: Tank): void {
    if (!tank.shootingDelay.positive) return;
    const barWidth = tank.width * 0.9;
    // NOTE: Draw health bar in camera size, since it's a UI element and it should not scale.
    const barHeight = 3 / renderer.camera.scale;
    const barOffset = 3 / renderer.camera.scale;
    const barX = tank.x + (tank.width - barWidth) / 2;
    const barY = tank.y - barHeight - barOffset;
    renderer.setFillColor(Color.ORANGE_SAFFRON);
    const reloadTime = tank.schema.reloadTime.milliseconds / tank.reloadMult;
    const fraction = 1 - tank.shootingDelay.milliseconds / reloadTime;
    renderer.fillRect(barX, barY, barWidth * fraction, barHeight);
}

function drawTankDevBoundary(renderer: Renderer, tank: Tank): void {
    renderer.setStrokeColor(Color.PINK);
    renderer.strokeBoundary(tank, 1);
    renderer.setFont('400 16px Helvetica', 'center', 'middle');
    renderer.setFillColor(Color.WHITE);
    const velocity = ((tank.velocity * 3600) / 1000).toFixed(2);
    const acc = tank.lastAcceleration.toFixed(2);
    renderer.fillText(
        `${tank.id}: m=${tank.speedMult};a=${acc};v=${velocity}km/h`,
        // `ID:${tank.id}: {${Math.floor(tank.x)};${Math.floor(tank.y)}}`,
        {
            x: tank.x + tank.width / 2,
            y: tank.y - tank.height / 2,
        },
    );
}

function drawEnemyDevTargetPath(renderer: Renderer, tank: EnemyTank): void {
    if (tank.targetPath.length < 2) {
        return;
    }
    renderer.setStrokeColor('blue');
    renderer.setFillColor('blue');
    const p0 = tank.targetPath[0]!;
    renderer.strokeLine(p0.x, p0.y, tank.x + tank.width / 2, tank.y + tank.height / 2, 1);
    renderer.setStrokeColor(Color.ORANGE_SAFFRON);
    renderer.setFillColor(Color.ORANGE_SAFFRON);
    for (let i = 0; i < tank.targetPath.length - 1; i++) {
        const p1 = tank.targetPath[i];
        assert(p1);
        renderer.fillCircle(p1.x, p1.y, 2);
        const p2 = tank.targetPath[i + 1];
        assert(p2);
        renderer.strokeLine(p1.x, p1.y, p2.x, p2.y, 1);
    }
}
