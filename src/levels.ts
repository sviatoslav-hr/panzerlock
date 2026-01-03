import {PickupType} from '#/entity/pickup';
import {TankKind} from '#/entity/tank/generation';

export interface LevelDesc {
    enemies: {
        queue: (TankKind | {kind: TankKind; shields: number})[];
        spawnedMax: number;
    };
    pickups?: {
        forced?: PickupType[];
        random?: {
            types?: PickupType[];
            count: number;
        };
        // MAYBE: have both random and predefined pickups?
    };
}

export const levelsPerDepth: Record<number, LevelDesc> = {
    1: {
        enemies: {
            queue: ['light'],
            spawnedMax: 1,
        },
        pickups: {},
    },
    2: {
        enemies: {
            // NOTE: In the next room we teach player that he can play against multiple enemies at once.
            queue: ['light', 'light'],
            spawnedMax: 2,
        },
        pickups: {},
    },
    3: {
        enemies: {
            queue: ['light', 'medium'],
            spawnedMax: 2,
        },
        pickups: {},
    },
    4: {
        enemies: {
            // NOTE: In this room we show that more enemies can respawn.
            queue: ['light', 'medium', 'light'],
            spawnedMax: 2,
        },
        pickups: {},
    },
    5: {
        enemies: {
            queue: ['light', 'medium', 'light', 'medium'],
            spawnedMax: 2,
        },
        pickups: {},
    },
    6: {
        enemies: {
            queue: ['light', 'medium', 'light', 'medium'],
            spawnedMax: 3,
        },
        pickups: {},
    },
    7: {
        enemies: {
            queue: ['light', 'light', 'medium', 'light', 'light'],
            spawnedMax: 3,
        },
        pickups: {},
    },
    8: {
        enemies: {
            queue: ['light', 'light', 'medium', 'light', 'medium'],
            spawnedMax: 3,
        },
        pickups: {},
    },
    9: {
        enemies: {
            queue: ['light', 'light', 'heavy', 'light', 'medium'],
            spawnedMax: 3,
        },
        pickups: {},
    },
    10: {
        enemies: {
            queue: ['light', 'medium', 'heavy', 'light', 'medium'],
            spawnedMax: 3,
        },
        pickups: {},
    },
    11: {
        enemies: {
            queue: ['light', 'light', 'heavy', 'medium', 'medium'],
            spawnedMax: 3,
        },
        pickups: {},
    },
    12: {
        enemies: {
            queue: ['light', 'medium', 'heavy', 'medium', 'light', 'medium'],
            spawnedMax: 3,
        },
        pickups: {},
    },
    13: {
        enemies: {
            queue: ['light', 'medium', 'heavy', 'light', 'medium', 'heavy'],
            spawnedMax: 3,
        },
        pickups: {},
    },
    14: {
        enemies: {
            queue: ['light', 'medium', 'heavy', 'light', 'medium', 'heavy'],
            spawnedMax: 4,
        },
        pickups: {},
    },
    15: {
        enemies: {
            queue: ['light', 'medium', 'medium', 'heavy', 'medium', 'medium', 'heavy', 'light'],
            spawnedMax: 4,
        },
        pickups: {},
    },
    16: {
        enemies: {
            // prettier-ignore
            queue: ['light', 'medium', 'light', 'medium', 'light', 'medium', 'light', 'medium', 'light', 'medium'],
            spawnedMax: 4,
        },
        pickups: {},
    },
    17: {
        enemies: {
            // prettier-ignore
            queue: ['light', 'medium', 'heavy', 'light', 'medium', 'heavy', 'light', 'medium', 'heavy', 'light', 'medium', 'heavy'],
            spawnedMax: 4,
        },
        pickups: {},
    },
    18: {
        enemies: {
            queue: ['heavy', 'heavy', 'light', 'medium', 'light', 'light', 'medium', 'medium'],
            spawnedMax: 5,
        },
        pickups: {},
    },
    19: {
        enemies: {
            // prettier-ignore
            queue: ['heavy', 'medium', 'light', 'heavy', 'medium', 'heavy', 'light', 'medium', 'heavy', 'light', 'medium', 'heavy'],
            spawnedMax: 5,
        },
        pickups: {},
    },
    20: {
        enemies: {
            // prettier-ignore
            queue: ['heavy', 'heavy', 'medium', 'light', 'heavy', 'heavy', 'medium', 'light', 'heavy', 'heavy', 'medium', 'light'],
            spawnedMax: 5,
        },
        pickups: {},
    },
};

export const TOTAL_LEVELS = Object.keys(levelsPerDepth).length;
