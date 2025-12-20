import {Color} from '#/color';
import {CELL_SIZE} from '#/const';
import {EnemyTank, isEnemyTank, isPlayerTank, PlayerTank, Tank} from '#/entity/tank';
import {Renderer} from '#/renderer';
import {roomSizeInCells} from '#/world/room';

export function drawAllTankModels(renderer: Renderer, tanks: Tank[]): void {
    for (const tank of tanks) {
        if (tank.dead) continue;
        tank.sprite.draw(renderer, tank, tank.direction);
        if (tank.hasShield) {
            tank.shieldSprite.draw(renderer, tank.shieldBoundary);
        }
    }
}

export function drawTanksFloatUI(renderer: Renderer, tanks: Tank[]): void {
    for (const tank of tanks) {
        // NOTE: Draw health bar animation even if dead for dramatic effect.
        // NOTE: Draw hp bar only if the tank is not full health.
        if ((!tank.dead || tank.healthAnimation.active) && tank.health < tank.schema.maxHealth) {
            drawTankHealthBarAbove(renderer, tank);
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

function drawTankHealthBarAbove(renderer: Renderer, tank: Tank) {
    const barWidth = tank.width * 0.9;
    // NOTE: Draw health bar in camera size, since it's a UI element and it should not scale.
    const barHeight = 3 / renderer.camera.scale;
    const barOffset = 6 / renderer.camera.scale;
    const barX = tank.x + (tank.width - barWidth) / 2;
    const barY = tank.y - barHeight - barOffset;
    renderer.setFillColor(Color.GREEN_DARKEST);
    renderer.fillRect(barX, barY, barWidth, barHeight);
    let hpFraction = tank.health / tank.schema.maxHealth || 0;
    if (!tank.healthAnimation.finished) {
        const healthLostFraction = Math.abs(tank.health - tank.prevHealth) / tank.schema.maxHealth;
        hpFraction += (1 - tank.healthAnimation.progress) * healthLostFraction;
    }
    if (hpFraction) {
        renderer.setFillColor(Color.GREEN);
        renderer.fillRect(barX, barY, barWidth * hpFraction, barHeight);
    }
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

    const fromHealth = player.prevHealth;
    const toHealth = player.health;
    let animatedHpFraction = toHealth / player.schema.maxHealth || 0;
    if (!player.healthAnimation.finished) {
        const healthDiff = toHealth - fromHealth;
        const animatedHealth = fromHealth + healthDiff * player.healthAnimation.progress;
        animatedHpFraction = animatedHealth / player.schema.maxHealth || 0;
    }

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
