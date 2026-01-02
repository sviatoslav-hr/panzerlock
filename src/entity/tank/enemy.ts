import {CELL_SIZE} from '#/const';
import {Entity} from '#/entity/core';
import {findCollided, isPosOccupied} from '#/entity/lookup';
import {EnemyTank, isEnemyTank} from '#/entity/tank';
import {TankKind} from '#/entity/tank/generation';
import {initTank} from '#/entity/tank/simulation';
import {getRectCenter, oppositeDirection} from '#/math';
import {Direction} from '#/math/direction';
import {Duration} from '#/math/duration';
import {random} from '#/math/rng';
import {v2Add, v2EqualsApprox, v2ManhattanDistance, v2RoundMut, Vector2Like} from '#/math/vector';
import {findAStarPath} from '#/pathfinding';
import {GameState} from '#/state';
import {acknowledgeEnemySpawned, queueEnemy} from '#/entity/enemy-wave';

export const ENEMY_SPAWN_FREEZE_DELAY = Duration.milliseconds(500);
const ENEMY_PATHFIND_DELAY_MIN = Duration.milliseconds(2000);
const ENEMY_PATHFIND_DELAY_MAX = Duration.milliseconds(5000);
const ENEMY_PATHFIND_RESTART_DELAY = Duration.milliseconds(500);

export function spawnEnemy(state: GameState, enemyKind?: TankKind, skipDelay = false): EnemyTank {
  const deadEnemy = state.tanks.find(
    (t) => isEnemyTank(t) && t.dead && !t.shouldRespawn,
  ) as EnemyTank;
  // NOTE: Enemy will be dead initially, but it will be re-spawned automatically with the delay
  // to not spawn it immediately and also have the ability to not spawn everyone at once.
  const enemy = deadEnemy ?? new EnemyTank();
  assert(enemy.dead);
  if (!deadEnemy) {
    // NOTE: Player should be drawn last, so enemies are added to the beginning of the array.
    state.tanks.unshift(enemy);
  }
  const wave = state.world.activeRoom.wave;
  enemy.shouldRespawn = true;
  if (skipDelay) {
    if (enemyKind) enemy.changeKind(enemyKind);
    respawnEnemy(enemy, state);
  } else {
    queueEnemy(wave, enemy, enemyKind);
  }
  return enemy;
}

export function respawnEnemy(tank: EnemyTank, state: GameState): boolean {
  assert(tank.dead);
  assert(tank.shouldRespawn);

  const room = state.world.activeRoom;
  const boundary = room.boundary;
  const roomSpawns: Vector2Like[] = [
    {
      x: boundary.x + boundary.width - CELL_SIZE / 2,
      y: boundary.y + boundary.height - CELL_SIZE / 2,
    },
    {x: boundary.x + CELL_SIZE / 2, y: boundary.y + boundary.height - CELL_SIZE / 2},
    {x: boundary.x + CELL_SIZE / 2, y: boundary.y + CELL_SIZE / 2},
    {x: boundary.x + boundary.width - CELL_SIZE / 2, y: boundary.y + CELL_SIZE / 2},
  ];
  random.shuffle(roomSpawns);

  let spawnPoint: Vector2Like | undefined;
  while ((spawnPoint = roomSpawns.pop())) {
    const occupied = isPosOccupied(spawnPoint, state, tank.width / 2);
    if (!occupied) {
      tank.x = spawnPoint.x - tank.width / 2;
      tank.y = spawnPoint.y - tank.height / 2;
      initTank(tank);
      acknowledgeEnemySpawned(state.world.activeRoom.wave, tank.id);
      return true;
    }
  }

  tank.spawnFreezeTimer.setFrom(ENEMY_SPAWN_FREEZE_DELAY);
  // prettier-ignore
  logger.debug('Delaying respawn for enemy tank %d because all spawn points are occupied', tank.id);
  return false;
}

export function chooseEnemyDirection(tank: EnemyTank, state: GameState, dt: Duration): void {
  const player = state.player;
  if (player.dead) return;

  tank.pathfindDelay.sub(dt).max(0);
  tank.pathfindRestartDelay.sub(dt).max(0);

  const newDirection = findEnemyTargetDirection(tank, player, state);
  if (newDirection != null && newDirection !== tank.direction) {
    tank.velocity = 0;
    tank.direction = newDirection;
  }
}

function findEnemyTargetDirection(
  enemy: EnemyTank,
  target: Entity,
  state: GameState,
): Direction | null {
  if (!enemy.pathfindDelay.milliseconds) {
    const delayMilliseconds = random.int32Range(
      ENEMY_PATHFIND_DELAY_MIN.milliseconds,
      ENEMY_PATHFIND_DELAY_MAX.milliseconds,
    );
    enemy.pathfindDelay.setMilliseconds(delayMilliseconds);
    const path = calculateEnemyPath(enemy, target, state);
    const nextPoint = path?.[0];
    if (nextPoint) return getTankDirectionToPoint(enemy, nextPoint);
    return null;
  }

  const targetPoint = enemy.targetPath[0];
  if (targetPoint) {
    // PERF: This creates a new vector object every simulation frame
    //       and it's only used for simple check... Sad.
    const enemyCenter = getRectCenter(enemy);
    const eps = 1;
    if (v2EqualsApprox(enemyCenter, targetPoint, eps)) {
      enemy.targetPath.shift();
      const nextPoint = enemy.targetPath[0];
      return nextPoint ? getTankDirectionToPoint(enemy, nextPoint) : null;
    }
    return getTankDirectionToPoint(enemy, targetPoint);
  }

  // NOTE: Try to restart pathfinding in case path was reached before the timer has expired.
  //       Have to use restart to prevent spamming search when path is impossible to find.
  tryRestartEnemyPathfinding(enemy);
  if (!enemy.pathfindDelay.milliseconds) {
    return findEnemyTargetDirection(enemy, target, state);
  }
  return null;
}

function calculateEnemyPath(
  enemy: EnemyTank,
  target: Entity,
  state: GameState,
): Vector2Like[] | null {
  const targetCenter = v2RoundMut(getRectCenter(target));
  const tankCenter = v2RoundMut(getRectCenter(enemy));
  const dirOffset = Math.round((CELL_SIZE * 0.8) / 5);
  const directions: Vector2Like[] = [
    {x: 0, y: -dirOffset},
    {x: dirOffset, y: 0},
    {x: 0, y: dirOffset},
    {x: -dirOffset, y: 0},
  ];
  const posOffset = Math.round(enemy.width / 2) + 1;
  const ignoreEntities = [enemy.id, state.player.id];

  const path = findAStarPath({
    start: tankCenter,
    goal: targetCenter,
    heuristic: v2ManhattanDistance,
    isGoalReached: (pos, goal) => v2EqualsApprox(pos, goal, posOffset),
    getNeighbors: (pos) => {
      const neighbors: Vector2Like[] = [];
      for (const dir of directions) {
        const neighborPos = v2RoundMut(v2Add(pos, dir));
        if (!isPosOccupied(neighborPos, state, posOffset, ignoreEntities)) {
          neighbors.push(neighborPos);
        }
      }
      return neighbors;
    },
  });

  path?.shift(); // Remove the start point since enemy is already there.
  if (path) enemy.targetPath = path;
  return path;
}

export function hanldeOversteppedEnemyPathPoint(tank: EnemyTank, state: GameState) {
  const targetPoint = tank.targetPath[0];
  if (tank.collided || !targetPoint) return;

  const directionAfterMovement = getTankDirectionToPoint(tank, targetPoint);
  if (!directionAfterMovement) {
    // NOTE: If enemy is already at the target point, remove it from the path
    //       so that enemy can move to the next point.
    tank.targetPath.shift();
    return;
  }
  // NOTE: If direction after movement is opposite to the current direction, that means
  //       the enemy has moved past the target point.
  if (directionAfterMovement === oppositeDirection(tank.direction)) {
    tank.targetPath.shift(); // Remove passed point
    const nextPoint = tank.targetPath[0];
    if (nextPoint) {
      const nextDirection = getTankDirectionToPoint(tank, nextPoint);
      if (!nextDirection || nextDirection === tank.direction) return;

      // NOTE: If even next direction is still different from the current, than means
      //       the path is takes a turn, so we need to align the tank with the path axis.
      const prevX = tank.x;
      const prevY = tank.y;
      if (nextDirection === Direction.EAST || nextDirection === Direction.WEST) {
        tank.y = targetPoint.y - tank.height / 2;
      } else if (nextDirection === Direction.NORTH || nextDirection === Direction.SOUTH) {
        tank.x = targetPoint.x - tank.width / 2;
      }
      const collided = findCollided(state, tank);
      if (collided) {
        tank.x = prevX;
        tank.y = prevY;
      } else {
        tank.direction = nextDirection;
        tank.velocity = 0;
      }
    }
  }
}

function getTankDirectionToPoint(tank: EnemyTank, next: Vector2Like): Direction | null {
  const dx = next.x - Math.round(tank.cx);
  if (dx !== 0) {
    return dx > 0 ? Direction.EAST : Direction.WEST;
  }
  const dy = next.y - Math.round(tank.cy);
  if (dy !== 0) {
    return dy > 0 ? Direction.SOUTH : Direction.NORTH;
  }
  // NOTE: null means tank is already at the target point
  return null;
}

export function tryRestartEnemyPathfinding(tank: EnemyTank): void {
  if (tank.pathfindRestartDelay.positive) return;
  tank.pathfindDelay.setMilliseconds(0);
  tank.pathfindRestartDelay.setFrom(ENEMY_PATHFIND_RESTART_DELAY);
}
