import {EntityId} from '#/entity/id';
import {EnemyTank} from '#/entity/tank';
import {TankKind} from '#/entity/tank/generation';

function newEnemyWave(
    // NOTE: Waves are being reused per each restart, so we want to keep the original order of enemies.
    expectedEnemies: readonly TankKind[],
    enemyLimitAtOnce: number,
): EnemyWave {
    assert(enemyLimitAtOnce > 0);
    return {
        aliveEnemies: [],
        enemyRespawnQueue: [],
        expectedEnemyIndex: 0,
        expectedEnemies,
        enemyLimitAtOnce,
    };
}

export interface EnemyWave {
    aliveEnemies: EntityId[];
    enemyRespawnQueue: EntityId[];
    expectedEnemyIndex: number;
    readonly expectedEnemies: readonly TankKind[];
    readonly enemyLimitAtOnce: number;
}

export function isWaveCleared(wave: EnemyWave): boolean {
    return wave.aliveEnemies.length + wave.enemyRespawnQueue.length === 0;
}

export function waveHasRespawnPlace(wave: EnemyWave): boolean {
    return wave.aliveEnemies.length < wave.enemyLimitAtOnce;
}

export function waveHasExpectedEnemies(wave: EnemyWave): boolean {
    return wave.expectedEnemyIndex < wave.expectedEnemies.length;
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
        const expectedKind = wave.expectedEnemies[wave.expectedEnemyIndex];
        if (wave.expectedEnemyIndex < wave.expectedEnemies.length) {
            wave.expectedEnemyIndex++;
        }
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

interface EnemyWaveConfig {
    enemies: TankKind[]; // rename to `queue`?
    limitAtOnce?: number; // By default inherits from prev room
}

// NOTE: Wave index corresponds to the room index.
export const wavesPerRoom = makeWaves(
    // {enemies: ['light', 'medium', 'heavy'], limitAtOnce: 3}, // NOTE: This is a test wave, only for dev purposes.
    // NOTE: Start with one medium tank: not overwhelming with many enemies, but also not too easy to kill.
    {enemies: ['light'], limitAtOnce: 1},
    {enemies: ['light', 'light'], limitAtOnce: 2}, // NOTE: In the next room we teach player that he can play against multiple enemies at once.
    {enemies: ['light', 'medium']},
    {enemies: ['light', 'medium', 'light']}, // NOTE: In this room we show that more enemies can respawn.
    {enemies: ['light', 'medium', 'light', 'medium']},
    {enemies: ['light', 'medium', 'light', 'medium'], limitAtOnce: 3},
    {enemies: ['light', 'light', 'medium', 'light', 'light']},
    {enemies: ['light', 'light', 'medium', 'light', 'medium']},
    {enemies: ['light', 'light', 'heavy', 'light', 'medium']},
    {enemies: ['light', 'medium', 'heavy', 'light', 'medium']},
    {enemies: ['light', 'light', 'heavy', 'medium', 'medium']},
    {enemies: ['light', 'medium', 'heavy', 'medium', 'light', 'medium']},
    {enemies: ['light', 'medium', 'heavy', 'light', 'medium', 'heavy']},
    {enemies: ['light', 'light', 'medium', 'heavy', 'light', 'medium', 'heavy'], limitAtOnce: 4},
    {enemies: ['light', 'medium', 'medium', 'heavy', 'medium', 'medium', 'heavy', 'light']},
    // prettier-ignore
    {enemies: ['light', 'medium', 'light', 'medium', 'light', 'medium', 'light', 'medium', 'light', 'medium']},
    // prettier-ignore
    {enemies: ['light', 'medium', 'heavy', 'light', 'medium', 'heavy', 'light', 'medium', 'heavy', 'light', 'medium', 'heavy']},
    // prettier-ignore
    {enemies: ['heavy', 'heavy', 'light', 'medium', 'light', 'light', 'medium', 'medium'], limitAtOnce: 5},
    // prettier-ignore
    {enemies: ['heavy', 'medium', 'light', 'heavy', 'medium', 'heavy', 'light', 'medium', 'heavy', 'light', 'medium', 'heavy']},
    // prettier-ignore
    {enemies: ['heavy', 'heavy', 'medium', 'light', 'heavy', 'heavy', 'medium', 'light', 'heavy', 'heavy', 'medium', 'light']},
);

function makeWaves(...configs: EnemyWaveConfig[]): EnemyWave[] {
    const waves: EnemyWave[] = configs.map((config, i) => {
        assert(config.enemies.length);
        if (config.limitAtOnce == null) {
            const prevWaveConfig = configs[i - 1];
            assert(prevWaveConfig?.limitAtOnce != null);
            config.limitAtOnce = prevWaveConfig.limitAtOnce;
        }

        const wave = newEnemyWave(config.enemies.slice(), config.limitAtOnce);
        return wave;
    });
    return waves;
}
