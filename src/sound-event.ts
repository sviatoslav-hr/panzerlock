import {playSoundFrom, Sound, type SoundInput, SoundContext, SoundName} from '#/sound';

export type SoundEventType =
    | 'game-started'
    | 'game-over'
    | 'game-victory'
    | 'enemy-shooting'
    | 'enemy-damaged'
    | 'enemy-destroyed'
    | 'player-shooting'
    | 'player-damaged'
    | 'player-destroyed';

const allSoundsInputs: Record<SoundEventType, SoundInput> = {
    ['game-started']: {name: SoundName.LEVEL_START, volume: 0.5},
    ['game-over']: {name: SoundName.GAME_OVER, volume: 1},
    ['game-victory']: {name: SoundName.VICTORY, volume: 1},
    // TODO: room-cleared

    ['enemy-shooting']: {name: SoundName.SHOOTING, volume: 0.15},
    ['enemy-damaged']: {name: SoundName.HIT, volume: 0.3},
    ['enemy-destroyed']: {name: SoundName.EXPLOSION, volume: 0.6},

    ['player-shooting']: {name: SoundName.SHOOTING, volume: 0.6},
    ['player-damaged']: {name: SoundName.HIT, volume: 0.8},
    ['player-destroyed']: {name: SoundName.EXPLOSION, volume: 1},
};

export function soundEvent(ctx: SoundContext, soundType: SoundEventType): Sound {
    const input = allSoundsInputs[soundType];
    const sound = playSoundFrom(ctx, input);
    return sound;
}
