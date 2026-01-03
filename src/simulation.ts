import {CELL_SIZE} from '#/const';
import {Boom, ParticleExplosion} from '#/effect';
import {waveHasExpectedEnemies} from '#/entity/enemy-wave';
import {simulatePickups} from '#/entity/pickup';
import {simulateAllProjectiles} from '#/entity/projectile';
import {spawnEnemy} from '#/entity/tank/enemy';
import {deactivateTankShield, initTank, simulateAllTanks} from '#/entity/tank/simulation';
import {Direction} from '#/math/direction';
import {Duration} from '#/math/duration';
import {Camera} from '#/renderer/camera';
import {GameState} from '#/state';
import {getNextRoomWhenReached, updateActiveRoomStates} from '#/world/room';
import {initWorld, resetWorld} from '#/world/world';

export function initEntities(state: GameState): void {
    state.tanks = [state.player];
    state.projectiles = [];
    state.effects = [];
    state.booms = [];
    resetWorld(state.world);
    initTank(state.player);
    initWorld(state);
}

export function simulateEntities(dt: Duration, state: GameState, camera: Camera): void {
    simulateEffects(dt, state);
    const world = state.world;
    updateActiveRoomStates(state);
    const nextRoom = getNextRoomWhenReached(world.activeRoom, state.player);
    if (nextRoom) {
        world.activeRoom = nextRoom;
        world.activeRoomInFocus = false;
    }

    if (!world.activeRoomInFocus) {
        // NOTE: This will also trigger after reset.
        camera.focusOnRect(world.activeRoom.boundary);
        world.activeRoomInFocus = true;
    }

    if (world.activeRoom.started) {
        const wave = world.activeRoom.wave;
        while (waveHasExpectedEnemies(wave)) {
            spawnEnemy(state);
        }
    }
    simulateAllTanks(dt, state);
    simulateAllProjectiles(dt, state);
    simulatePickups(dt, state);
}

function simulateEffects(dt: Duration, state: GameState): void {
    const effectsToRemove: ParticleExplosion[] = [];
    for (const effect of state.effects) {
        effect.update(dt);
        if (effect.animation.finished) {
            effectsToRemove.push(effect);
        }
    }
    if (effectsToRemove.length) {
        state.effects = state.effects.filter((e) => !effectsToRemove.includes(e));
    }
    const boomsToRemove: Boom[] = [];
    for (const boom of state.booms) {
        boom.update(dt);
        if (boom.animation.finished) {
            boomsToRemove.push(boom);
        }
    }
    if (boomsToRemove.length) {
        state.booms = state.booms.filter((b) => !boomsToRemove.includes(b));
    }
}

export function setupMainBackgroundScene(state: GameState): void {
    // Setup initial background scene
    // state.world.roomsLimit = 1;
    initEntities(state);
    const room = state.world.activeRoom;
    const roomWidth = room.sizeInCells.x * CELL_SIZE;
    const roomHeight = room.sizeInCells.y * CELL_SIZE;
    const roomX = room.position.x - roomWidth / 2;
    const roomY = room.position.y - roomHeight / 2;
    const cellOffset = (CELL_SIZE - state.player.width) / 2;

    deactivateTankShield(state.player);
    const enemy00 = spawnEnemy(state, 'medium', true);
    deactivateTankShield(enemy00);
    enemy00.x = roomX + roomWidth / 2 - CELL_SIZE + cellOffset - CELL_SIZE * 2;
    enemy00.y = roomY + cellOffset;
    enemy00.direction = Direction.EAST;
    const enemy01 = spawnEnemy(state, 'heavy', true);
    enemy01.x = roomX + roomWidth - CELL_SIZE + cellOffset;
    enemy01.y = roomY + cellOffset + CELL_SIZE * 2;
    enemy01.direction = Direction.NORTH;
    deactivateTankShield(enemy01);
    const enemy10 = spawnEnemy(state, 'light', true);
    enemy10.x = roomX + roomWidth / 2 - CELL_SIZE + cellOffset;
    enemy10.y = roomY + roomHeight - CELL_SIZE + cellOffset;
    enemy10.direction = Direction.NORTH;
    deactivateTankShield(enemy10);
    const enemy11 = spawnEnemy(state, 'medium', true);
    enemy11.x = roomX + roomWidth - CELL_SIZE + cellOffset - CELL_SIZE;
    enemy11.y = roomY + roomHeight - CELL_SIZE + cellOffset;
    enemy11.direction = Direction.WEST;
    deactivateTankShield(enemy11);
}
