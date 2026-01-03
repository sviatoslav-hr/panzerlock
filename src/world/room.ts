import {CELL_SIZE} from '#/const';
import {PlayerTank} from '#/entity';
import {Block} from '#/entity/block';
import {Entity, isIntesecting} from '#/entity/core';
import {EnemyWave, isWaveCleared, makeEnemyWave, resetWave} from '#/entity/enemy-wave';
import {Pickup} from '#/entity/pickup';
import {levelsPerDepth} from '#/levels';
import {Rect} from '#/math';
import {Direction, getDirectionBetween} from '#/math/direction';
import {Vector2} from '#/math/vector';
import {GameState} from '#/state';
import {WorldNode} from '#/world/graph';

export const roomSizeInCells = new Vector2(12, 8);

// TODO: Room code needs to be refactored, it's too complex, intermingled and messy #roomgen
export interface Room {
    started: boolean;
    readonly depth: number;
    readonly wave: EnemyWave;
    readonly position: Vector2;
    readonly sizeInCells: Vector2;

    readonly node: WorldNode;
    readonly boundary: Rect;
    readonly blocks: Block[];
    pickups: Pickup[]; // = []

    nextRoomDoorOpen: boolean;
    readonly nextRooms: Room[];
    readonly nextRoomDirs: Direction[];
    readonly nextRoomCommonBlocks: Block[];
    readonly nextRoomTransitionRects: Rect[];

    readonly prevRooms: Room[];
    readonly prevRoomDoorBlocks: Block[];
}

export function isRoomCompleted(room: Room): boolean {
    return room.started && isWaveCleared(room.wave);
}

export function newRoom(
    node: WorldNode,
    position: Vector2,
    sizeInCells: Vector2,
    blocks: Block[],
    prevRooms: Room[],
    nextRoomDirs: Direction[],
    nextRoomCommonBlocks: Block[],
): Room {
    const boundary: Rect = {
        x: position.x - 0.5 * CELL_SIZE * sizeInCells.width,
        y: position.y - 0.5 * CELL_SIZE * sizeInCells.height,
        width: CELL_SIZE * sizeInCells.width,
        height: CELL_SIZE * sizeInCells.height,
    };
    const nextRoomTransitionRects = nextRoomDirs.map((nextDir) =>
        makeNextRoomTransitionRect(position, sizeInCells, nextDir),
    );
    const depth = node.depth;
    const level = levelsPerDepth[depth];
    assert(level, `Level description for depth ${depth} doesn't exist.`);
    const wave = makeEnemyWave(level);
    // TODO: Clone the wave, just in case. But currently, there shouldn't be any problems with it.
    resetWave(wave);
    // const prevRoomCommonBlocks = prevRooms.flatMap((p) => p.nextRoomCommonBlocks.slice());
    // this.prevRoomDoorBlocks = prevRoomCommonBlocks.filter((block) => {
    //     prevRooms.some((p) => p.nextRoomTransitionRects.some((r) => isIntersecting(block, r)));
    // });
    // TODO: For some reason, previous code doesn't work, but this does...
    // PERF: Also, this is not optimal - too much looping.
    const prevRoomDoorBlocks = prevRooms.flatMap((p) =>
        p.nextRoomCommonBlocks.filter((b) =>
            p.nextRoomTransitionRects.some((r) => isIntesecting(b, r)),
        ),
    );
    assert(depth === 1 || prevRoomDoorBlocks.length >= 2);

    const room: Room = {
        started: false,
        depth,
        wave,
        position,
        sizeInCells,

        node,
        boundary,
        blocks,
        pickups: [],

        nextRoomDoorOpen: false,
        nextRooms: [],
        nextRoomDirs,
        nextRoomCommonBlocks,
        nextRoomTransitionRects,

        prevRooms,
        prevRoomDoorBlocks,
    };
    for (const p of prevRooms) {
        p.nextRooms.push(room);
    }

    return room;
}

// HACK: This is only used as a temporary replaced for the first room to not make it nullable.
export function tempRoom(): Room {
    const zero: WorldNode = {x: 0, y: 0, depth: 1, connectedNodes: {}};
    const room = newRoom(zero, new Vector2(0, 0), roomSizeInCells, [], [], [Direction.NORTH], []);
    return room;
}

export function updateActiveRoomStates(state: GameState): void {
    const room = state.world.activeRoom;
    if (!room.started) {
        maybeStartRoom(room, state.player);
    } else if (isRoomCompleted(room) && !room.nextRoomDoorOpen) {
        if (room.nextRooms.length) {
            logger.debug(
                '[Room] Room %i cleared. Opening door to room %i',
                room.depth,
                room.depth + 1,
            );
            openNextRoomDoors(room);
        } else {
            logger.debug('[Room] Last room %i cleared.', room.depth);
            // HACK: Last room doesn't have doors, we just mark to not flood with logs.
            room.nextRoomDoorOpen = true;
        }
    }
}

export function getNextRoomWhenReached(room: Room, player: Entity): Room | null {
    if (!room.nextRooms.length || !room.nextRoomDoorOpen) return null;
    const rectIndex = room.nextRoomTransitionRects.findIndex((r) => isIntesecting(player, r));
    if (rectIndex === -1) return null;
    const nextDirection = room.nextRoomDirs[rectIndex];
    assert(nextDirection);
    const nextRoom = room.nextRooms.find(
        (r) => getDirectionBetween(room.node, r.node) === nextDirection,
    );
    assert(nextRoom);
    return nextRoom;
}

function maybeStartRoom(room: Room, player: PlayerTank): void {
    assert(!room.started);
    if (!isIntesecting(player, room.boundary)) {
        return;
    }

    const isPlayerInsideDoors = room.prevRoomDoorBlocks.some((b) => isIntesecting(b, player));
    if (!isPlayerInsideDoors) {
        for (const b of room.prevRoomDoorBlocks) {
            b.dead = false;
        }
        room.started = true;
    }
}
function openNextRoomDoors(room: Room): void {
    for (const searchRect of room.nextRoomTransitionRects) {
        // TODO: Instead of just removing the blocks, animate door opening.
        const block1 = room.blocks.find((b) => !b.dead && isIntesecting(b, searchRect));
        assert(block1 != null);
        block1.dead = true;
        const block2 = room.blocks.find((b) => !b.dead && isIntesecting(b, searchRect));
        assert(block2 != null);
        block2.dead = true;
    }
    room.nextRoomDoorOpen = true;
}

function makeNextRoomTransitionRect(
    position: Vector2,
    sizeInCells: Vector2,
    nextDoorDir: Direction,
): Rect {
    let x = position.x;
    let y = position.y;
    const xOffset = (sizeInCells.width * CELL_SIZE) / 2;
    const yOffset = (sizeInCells.height * CELL_SIZE) / 2;
    const rectASize = CELL_SIZE; // NOTE: Longer side is positioned across the wall.
    const rectBSize = CELL_SIZE / 2;
    const rectOffset = rectBSize / 2;
    // NOTE: Rect should be positioned in the middle of the wall.
    switch (nextDoorDir) {
        case Direction.NORTH:
            return {
                x: x - CELL_SIZE / 2,
                // NOTE: Since position is the top-left corner, we need to subtract the size in north and west directions.
                y: y - yOffset - rectBSize - rectOffset,
                width: rectASize,
                height: rectBSize,
            };
        case Direction.WEST:
            return {
                x: x - xOffset - rectBSize - rectOffset,
                y: y - CELL_SIZE / 2,
                width: rectBSize,
                height: rectASize,
            };
        case Direction.SOUTH:
            return {
                x: x - CELL_SIZE / 2,
                y: y + yOffset + rectOffset,
                width: rectASize,
                height: rectBSize,
            };
        case Direction.EAST:
            return {
                x: x + xOffset + rectOffset,
                y: y - CELL_SIZE / 2,
                width: rectBSize,
                height: rectASize,
            };
    }
}
