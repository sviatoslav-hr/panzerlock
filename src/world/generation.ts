import {CELL_SIZE} from '#/const';
import {Block, generateBlocks} from '#/entity/block';
import {generatePickups} from '#/entity/pickup';
import {Direction} from '#/math/direction';
import {random} from '#/math/rng';
import {Vector2} from '#/math/vector';
import {createStaticSprite} from '#/renderer/sprite';
import {GameState} from '#/state';
import {
    bfsWorldGraph,
    getPrevDepthWorldNodes,
    getWorldNodeDirections,
    getWorldNodeKey,
    type WorldGraph,
    type WorldNode,
    type WorldNodeKey,
} from '#/world/graph';
import {newRoom, Room, roomSizeInCells} from '#/world/room';
import {TOTAL_LEVELS} from '#/levels';

export const MAX_ROOMS_COUNT = TOTAL_LEVELS;

// TODO: Figure out generation algorithm that would avoid overlapping rooms
export function createRoomsFromGraph(graph: WorldGraph, state: GameState): Room[] {
    assert(graph.depth <= MAX_ROOMS_COUNT);
    const createdRooms: Map<WorldNodeKey, Room> = new Map();
    for (const node of bfsWorldGraph(graph.startNode)) {
        const nodeKey = getWorldNodeKey(node);
        if (createdRooms.has(nodeKey)) continue;
        const prevNodes = getPrevDepthWorldNodes(node);
        const prevRooms = prevNodes.map((prevNode) => {
            const room = createdRooms.get(getWorldNodeKey(prevNode));
            assert(room);
            return room;
        });
        const room = generateRoom(node, state, prevRooms);
        createdRooms.set(nodeKey, room);
    }
    return Array.from(createdRooms.values());
}

// TODO: This room generation code is awful, too intermingled and hard to follow #roomgen
function generateRoom(node: WorldNode, state: GameState, prevRooms: Room[]): Room {
    const sprite = createStaticSprite({
        key: 'bricks',
        frameWidth: 64,
        frameHeight: 64,
    });

    const {next: directionsToNextRooms, prev: directionsToPrevRooms} = getWorldNodeDirections(node);

    // NOTE: Room reuses common border blocks with the previous room
    const nextRoomBlocks: Block[] = [];
    const blocks: Block[] = prevRooms.flatMap((p) => p.nextRoomCommonBlocks.slice());
    const cellSize = CELL_SIZE;
    const roomOffset = Vector2.from(node).multiplyScalar(cellSize);
    const roomPosition = Vector2.from(node)
        .multiply(roomSizeInCells)
        .multiplyScalar(cellSize)
        .add(roomOffset);

    // north and south walls
    const minX = roomPosition.x - (roomSizeInCells.width / 2) * cellSize;
    for (let x = -1; x <= roomSizeInCells.width; x += 1) {
        // NOTE: north and south walls also include the corners
        if (x === -1 && directionsToPrevRooms.includes(Direction.WEST)) {
            continue;
        }
        if (x === roomSizeInCells.width && directionsToPrevRooms.includes(Direction.EAST)) {
            continue;
        }
        if (!directionsToPrevRooms.includes(Direction.NORTH)) {
            const northBlock = new Block({
                x: x * cellSize + minX,
                y: roomPosition.y - (roomSizeInCells.height / 2 + 1) * cellSize,
                width: cellSize,
                height: cellSize,
                texture: sprite,
            });
            blocks.push(northBlock);
            if (directionsToNextRooms.includes(Direction.NORTH)) nextRoomBlocks.push(northBlock);
        }
        if (!directionsToPrevRooms.includes(Direction.SOUTH)) {
            const southBlock = new Block({
                x: x * cellSize + minX,
                y: roomPosition.y + (roomSizeInCells.height / 2) * cellSize,
                width: cellSize,
                height: cellSize,
                texture: sprite,
            });
            blocks.push(southBlock);
            if (directionsToNextRooms.includes(Direction.SOUTH)) nextRoomBlocks.push(southBlock);
        }
    }

    // west and east walls
    const minY = roomPosition.y - (roomSizeInCells.height / 2) * cellSize;
    for (let y = 0; y < roomSizeInCells.height; y += 1) {
        if (!directionsToPrevRooms.includes(Direction.WEST)) {
            const westBlock = new Block({
                x: roomPosition.x - (roomSizeInCells.width / 2 + 1) * cellSize,
                y: y * cellSize + minY,
                width: cellSize,
                height: cellSize,
                texture: sprite,
            });
            blocks.push(westBlock);
            if (directionsToNextRooms.includes(Direction.WEST)) nextRoomBlocks.push(westBlock);
        }
        if (!directionsToPrevRooms.includes(Direction.EAST)) {
            const eastBlock = new Block({
                x: roomPosition.x + (roomSizeInCells.width / 2) * cellSize,
                y: y * cellSize + minY,
                width: cellSize,
                height: cellSize,
                texture: sprite,
            });
            blocks.push(eastBlock);
            if (directionsToNextRooms.includes(Direction.EAST)) nextRoomBlocks.push(eastBlock);
        }
    }

    if (directionsToNextRooms.length) {
        assert(nextRoomBlocks.length > 0);
    }

    const room = newRoom(
        node,
        roomPosition,
        roomSizeInCells,
        blocks,
        prevRooms,
        directionsToNextRooms,
        nextRoomBlocks,
    );
    const blocksCount = random.int32Range(16, 24);
    const insideBlocks = generateBlocks(state, room.boundary, blocksCount, state.player);
    room.blocks.push(...insideBlocks);

    generatePickups(room, state);

    return room;
}
