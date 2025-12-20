import {Result} from '#/common';
import {GameStorage} from '#/storage';

// TODO: Sound system should be genetic and now know about these specific sounds.
export enum SoundName {
    EXPLOSION = 'explosion_8bit',
    SHOOTING = 'cannon_fire',
    HIT = 'hit',
    GAME_OVER = 'game_over',
    LEVEL_START = 'level_start',
    BATTLE_THEME = 'too_strong',
    VICTORY = 'victory',
}

// TODO: These should be part of the sound context/config.
const SOUNDS_PATH = './sounds';
const GAME_VOLUME_KEY = 'game_volume';
const GAME_MUTED_KEY = 'game_muted';
const VOLUME_SCALE = 0.3; // Scale volume down because too loud by default.

export interface SoundInput {
    name: SoundName;
    volume: number;
    loop?: boolean;
}

export interface SoundContext {
    volume: number;
    muted: boolean;
    mutePromise: Promise<void> | null;
    readonly storage: GameStorage;
    readonly audio: AudioContext;
    readonly initiallyMuted: boolean; // NOTE: This is only used during initialization because context.state updates asynchronously.
    readonly soundsCache: Map<SoundName, Sound[]>;
}

export function newSoundContext(storage: GameStorage): SoundContext {
    const initiallyMuted = storage.getBool(GAME_MUTED_KEY) ?? false;
    const context: SoundContext = {
        volume: 1,
        muted: false,
        mutePromise: null,
        storage,
        // TODO: This should be created only after user made any action on the page.
        audio: new AudioContext(),
        initiallyMuted: initiallyMuted,
        soundsCache: new Map<SoundName, Sound[]>(),
    };
    if (context.initiallyMuted) {
        suspendAllSounds(context);
    }
    return context;
}

export function suspendAllSounds(context: SoundContext): void {
    if (context.muted) return;
    if (context.mutePromise) return;

    context.muted = true;
    context.storage.set(GAME_MUTED_KEY, context.muted);
    context.mutePromise = context.audio.suspend().then(() => {
        context.mutePromise = null;
    });
}

export async function loadAllSounds(context: SoundContext): Promise<void> {
    let volume = context.storage.getNumber(GAME_VOLUME_KEY);
    if (volume != null) {
        volume = Math.max(Math.min(1, volume), 0);
        context.volume = volume;
    }
    const promises: Promise<Result<void>>[] = [];
    for (const type of Object.values(SoundName)) {
        const soundSrc = getSoundSrcByName(type);
        const sound = newSound(soundSrc, context.audio);
        sound.volume = context.volume * VOLUME_SCALE;
        context.soundsCache.set(type, [sound]);
        promises.push(loadSound(sound));
    }
    const results = await Promise.all(promises);
    for (const result of results) {
        if (result.isErr()) {
            logger.error(result.contextErr('Failed to batch load sound').err);
        }
    }
}

export function setAllSoundsVolume(context: SoundContext, volume: number): void {
    context.volume = volume;
    context.storage.set(GAME_VOLUME_KEY, volume.toString());
    for (const [_, sounds] of context.soundsCache) {
        for (const sound of sounds) {
            setSoundVolume(sound, context.volume * VOLUME_SCALE);
        }
    }
}

export function resumeAllSounds(context: SoundContext): void {
    if (!context.muted) return;
    if (context.mutePromise) return;

    context.muted = false;
    context.storage.set(GAME_MUTED_KEY, context.muted);
    context.mutePromise = context.audio.resume().then(() => {
        context.mutePromise = null;
    });
}

export function playSoundFrom(context: SoundContext, input: SoundInput): Sound {
    const {name: type, volume: volumeScale = 1, loop = false} = input;
    const shouldPlay = context.audio.state === 'running' || loop;

    const cachedSounds = context.soundsCache.get(type);
    const availableSound = cachedSounds?.find((sound) => !isSoundPlaying(sound));
    if (availableSound) {
        if (shouldPlay) playSound(availableSound, volumeScale ?? 1, loop);
        return availableSound;
    }

    // NOTE: All sounds of this type are currently playing, so we need to clone one of them.
    const firstSound = cachedSounds?.[0];
    if (firstSound) {
        const clonedSound = cloneSound(firstSound);
        cachedSounds.push(clonedSound);
        if (shouldPlay) playSound(clonedSound, volumeScale ?? 1, loop);
        return clonedSound;
    }

    // NOTE: Can only happen if failed to preload the sound.
    const soundSrc = getSoundSrcByName(type);
    const sound = newSound(soundSrc, context.audio);
    context.soundsCache.set(type, [sound]);
    loadSound(sound).then((res) => {
        if (res.isOk()) {
            if (shouldPlay) playSound(sound, volumeScale ?? 1, loop);
        } else {
            logger.error(res.contextErr(`Failed to play sound: ${type}`).err);
        }
    });
    return sound;
}

enum SoundState {
    INIT,
    LOADING,
    LOADED,
    PLAYING,
    ERROR,
}

function getSoundSrcByName(type: SoundName): string {
    const src = type.includes('.') ? `${SOUNDS_PATH}/${type}` : `${SOUNDS_PATH}/${type}.wav`;
    return src;
}

export interface Sound {
    readonly src: string;
    state: SoundState;
    context: AudioContext;
    audioBuffer: AudioBuffer | null;
    gainNode: GainNode | null;
    source: AudioBufferSourceNode | null;
    shouldPlayOnceLoaded: boolean;
    volume: number;
    volumeScale: number;
    startTime: number;
    pauseTime: number;
    loop: boolean;
}

function newSound(src: string, context: AudioContext): Sound {
    return {
        state: SoundState.INIT,
        context,
        audioBuffer: null,
        gainNode: null,
        source: null,
        shouldPlayOnceLoaded: false,
        volume: 1,
        volumeScale: 1,
        startTime: 0,
        pauseTime: 0,
        loop: false,
        src,
    };
}

function setSoundVolume(sound: Sound, volume: number): void {
    if (sound.volume !== volume) {
        sound.volume = volume;
        if (sound.gainNode) {
            sound.gainNode.gain.value = volume * sound.volumeScale;
        }
    }
}

function isSoundPlaying(sound: Sound): boolean {
    return sound.state === SoundState.PLAYING;
}

function isSoundLoaded(sound: Sound): boolean {
    return sound.state >= SoundState.LOADED;
}

export function playSound(sound: Sound, volumeScale = sound.volumeScale, loop = sound.loop): void {
    if (!isSoundLoaded(sound) && loop) {
        // NOTE: Do this only for looped sounds, because not looped sounds may be timing-specific.
        sound.shouldPlayOnceLoaded = true;
        sound.volumeScale = volumeScale;
        sound.loop = loop;
        return;
    }
    startSoundAudioSource(sound, volumeScale, 0, loop);
    sound.startTime = sound.context.currentTime;
    sound.pauseTime = 0;
}

export function pauseSound(sound: Sound): void {
    assert(isSoundPlaying(sound), 'Can only pause playing sound');
    sound.source?.stop();
    sound.source = null; // NOTE: We can't pause the source, so we need to delete it.
    sound.state = SoundState.LOADED;
    sound.pauseTime = sound.context.currentTime - sound.startTime;
}

export function resumeSound(sound: Sound): void {
    startSoundAudioSource(sound, sound.volumeScale, sound.pauseTime, sound.loop);
}

export function stopSound(sound: Sound): void {
    sound.source?.stop();
    sound.source = null;
    sound.state = SoundState.LOADED;
    sound.pauseTime = 0;
}

function startSoundAudioSource(
    sound: Sound,
    volumeScale: number,
    startTime: number,
    loop: boolean,
): void {
    const gainNode = getSoundGainNode(sound, volumeScale);
    const audioSource = getSoundAudioSourceNode(sound, gainNode);
    audioSource.loop = sound.loop = loop;
    audioSource.start(0, startTime);
    sound.state = SoundState.PLAYING;
}

function getSoundAudioSourceNode(sound: Sound, gainNode: GainNode): AudioBufferSourceNode {
    const source = sound.context.createBufferSource();
    source.buffer = sound.audioBuffer;
    source.connect(gainNode);
    sound.source = source;
    return source;
}

function getSoundGainNode(sound: Sound, volumeScale: number): GainNode {
    if (volumeScale < 0) {
        logger.warn(
            `Sound: volume scale out of range: ${volumeScale}. Expected value bigger than 0.`,
        );
    }
    volumeScale = Math.max(0, volumeScale);
    if (sound.volumeScale !== volumeScale || !sound.gainNode) {
        sound.gainNode = sound.context.createGain();
        sound.gainNode.connect(sound.context.destination);
    }
    sound.volumeScale = volumeScale;
    sound.gainNode.gain.value = sound.volume * sound.volumeScale;
    return sound.gainNode;
}

function cloneSound(original: Sound): Sound {
    const sound = newSound(original.src, original.context);
    sound.state = original.state;
    sound.volume = original.volume;
    sound.volumeScale = original.volumeScale;
    sound.audioBuffer = original.audioBuffer;
    sound.gainNode = original.gainNode;
    return sound;
}

async function loadSound(sound: Sound): Promise<Result<void, Error>> {
    if (isSoundLoaded(sound)) {
        logger.warn(`Sound: already loaded: "${sound.src}"`);
        return Result.ok();
    }
    if (sound.state === SoundState.LOADING) {
        logger.warn(`Sound: already loading: "${sound.src}"`);
        return Result.ok();
    }

    sound.state = SoundState.LOADING;
    const bufferResult = await Result.async(fetch(sound.src))
        .contextErr(`Failed to fetch audio file "${sound.src}"`)
        .mapPromise((res) => res.arrayBuffer())
        .contextErr(`Failed to read audio file "${sound.src}" response as array buffer`)
        .mapPromise((buffer) => sound.context.decodeAudioData(buffer))
        .contextErr(`Failed to decode audio data for "${sound.src}"`);

    if (bufferResult.isErr()) {
        sound.state = SoundState.ERROR;
        return bufferResult.castValue();
    }

    sound.audioBuffer = bufferResult.value;
    sound.state = SoundState.LOADED;
    if (sound.shouldPlayOnceLoaded) playSound(sound);
    return Result.ok();
}
