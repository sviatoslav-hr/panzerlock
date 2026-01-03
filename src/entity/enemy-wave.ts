import {EntityId} from '#/entity/id';
import {EnemyTank} from '#/entity/tank';
import {TankKind} from '#/entity/tank/generation';
import {LevelDesc} from '#/levels';

export interface EnemyWave {
    aliveEnemies: EntityId[];
    enemyRespawnQueue: EntityId[];
    expectedEnemyIndex: number;
    readonly level: LevelDesc;
}

export function makeEnemyWave(level: LevelDesc): EnemyWave {
    return {
        aliveEnemies: [],
        enemyRespawnQueue: [],
        expectedEnemyIndex: 0,
        level: level,
    };
}

export function isWaveCleared(wave: EnemyWave): boolean {
    return wave.aliveEnemies.length + wave.enemyRespawnQueue.length === 0;
}

export function waveHasRespawnPlace(wave: EnemyWave): boolean {
    return wave.aliveEnemies.length < wave.level.enemies.spawnedMax;
}

export function waveHasExpectedEnemies(wave: EnemyWave): boolean {
    return wave.expectedEnemyIndex < wave.level.enemies.queue.length;
}

export function acknowledgeEnemySpawned(wave: EnemyWave, enemyId: EntityId): void {
    wave.aliveEnemies.push(enemyId);
    const index = wave.enemyRespawnQueue.indexOf(enemyId);
    if (index !== -1) {
        wave.enemyRespawnQueue.splice(index, 1);
    }
}

export function acknowledgeEnemyDied(wave: EnemyWave, enemyId: EntityId): void {
    const index = wave.aliveEnemies.indexOf(enemyId);
    if (index > -1) {
        wave.aliveEnemies.splice(index, 1);
    } else {
        logger.warn('Enemy tank with id %i not found even though it was destroyed', enemyId);
    }
}

export function queueEnemy(wave: EnemyWave, enemy: EnemyTank, enemyKind?: TankKind): void {
    if (!enemyKind) {
        const expectedEnemies = wave.level.enemies.queue;
        const expected = expectedEnemies[wave.expectedEnemyIndex];
        if (wave.expectedEnemyIndex < expectedEnemies.length) {
            wave.expectedEnemyIndex++;
        }
        const expectedKind = typeof expected === 'string' ? expected : expected?.kind;
        enemyKind = expectedKind ?? 'light';
    }
    enemy.changeKind(enemyKind);
    wave.enemyRespawnQueue.push(enemy.id);
}

export function resetWave(wave: EnemyWave): void {
    wave.aliveEnemies = [];
    wave.enemyRespawnQueue = [];
    wave.expectedEnemyIndex = 0;
}
