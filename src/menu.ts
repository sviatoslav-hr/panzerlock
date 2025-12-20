import {GameControlAction, type EventQueue} from '#/events';
import {computed, effect, signal, type Signal} from '#/signals';
import {WChildrenInput, wComponent, WCssStyleInput, WElementBasicAttributes} from '#/ui/w';
import {Duration} from './math/duration';

export type MenuView = 'main' | 'pause' | 'dead' | 'completed';

const VOLUME_MIN = 0;
const VOLUME_MAX = 50;
const VOLUME_DEFAULT = 25;
const VOLUME_CHANGE_STEP = 1;

export class MenuBridge {
    readonly view = signal<MenuView | null>('main');
    readonly volume = signal(VOLUME_DEFAULT);
    readonly muted = signal(false);
    readonly completionTime = signal<Duration | null>(null);
    fullscreenToggleExpected = false;

    private events: EventQueue;

    constructor(events: EventQueue) {
        this.events = events;
    }

    get visible(): boolean {
        return this.view() !== null;
    }

    props(): MenuProps {
        const onGameControl = (action: GameControlAction) => {
            this.events.push({type: 'game-control', action});
        };
        const onFullscreenToggle = () => {
            this.fullscreenToggleExpected = true;
        };
        return {
            view: this.view,
            volume: this.volume,
            muted: this.muted,
            completionTime: this.completionTime,
            onGameControl,
            onFullscreenToggle,
        };
    }
}

interface MenuProps {
    view: Signal<MenuView | null>;
    volume: Signal<number>;
    muted: Signal<boolean>;
    completionTime: Signal<Duration | null>;
    onGameControl: (action: GameControlAction) => void;
    onFullscreenToggle: () => void;
}

export const Menu = wComponent((w, props: MenuProps) => {
    const {volume, muted, view, completionTime, onGameControl, onFullscreenToggle} = props;

    return w.div(
        {
            class: 'menu',
            style: computed(() => {
                const styles: WCssStyleInput = {};
                if (view() == null) {
                    styles.display = 'none';
                }
                return styles;
            }),
        },
        w.div(
            {class: 'menu__sidebar'},
            w.h1({class: 'sidebar__header'}, () => {
                switch (view()) {
                    case 'main':
                        return 'PanzerLock';
                    case 'pause':
                        return 'Paused';
                    case 'dead':
                        return 'Game Over';
                    case 'completed':
                        return 'Game Completed';
                    default:
                        return null;
                }
            }),
            () =>
                completionTime()
                    ? w.h3(
                          {class: 'sidebar__completion'},
                          'Time: ' + completionTime()?.toHumanString(),
                      )
                    : null,
            computed(() => {
                if (view() !== 'pause') return null;
                return MenuButton(
                    {
                        onclick: () => onGameControl('resume'),
                    },
                    'Resume',
                );
            }),
            MenuButton(
                {
                    onclick: () => onGameControl('start'),
                },
                () => {
                    switch (view()) {
                        case 'main':
                            return 'Start';
                        case 'pause':
                        case 'dead':
                            return 'Restart';
                        case 'completed':
                            return 'Play Again';
                        case null:
                            return null;
                    }
                },
            ),
            w.div({class: 'menu__version'}, `v${GAME_VERSION}-${COMMIT_HASH}`),
        ),
        w.div(
            {class: 'menu__content'},
            MenuSettingsBar({volume, muted, onFullscreenToggle}),
            MenuControlsView(),
        ),
    );
});

const MenuControlsView = wComponent((w) => {
    return [
        w.div(
            {class: 'menu-controls'},
            w.h2({}, 'Controls'),
            w.ul(
                {class: 'controls-list'},
                w.li(
                    {},
                    w.code({}, 'W'),
                    ' ',
                    w.code({}, 'S'),
                    ' ',
                    w.code({}, 'A'),
                    ' ',
                    w.code({}, 'D'),
                    ' - Move',
                ),
                w.li({}, w.code({}, 'Space'), ' - Shoot'),
                w.li({}, w.code({}, 'P'), ' - Pause/Resume'),
                w.li({}, w.code({}, 'F'), ' - Toggle Fullscreen'),
                w.li({}, w.code({}, 'M'), ' - Toggle Music and Sounds'),
            ),
        ),
    ];
});

interface MenuSettingsProps {
    volume: Signal<number>;
    muted: Signal<boolean>;
    onFullscreenToggle: () => void;
}

const MenuSettingsBar = wComponent((w, props: MenuSettingsProps) => {
    const {volume: volumeInput, muted, onFullscreenToggle} = props;
    const volume = signal(Math.round(volumeInput() * VOLUME_MAX));
    effect(() => {
        volumeInput.set(volume() / VOLUME_MAX);
    });

    return [
        w.div(
            {class: 'menu-settings'},
            Slider({
                name: 'volume',
                min: VOLUME_MIN,
                max: VOLUME_MAX,
                step: VOLUME_CHANGE_STEP,
                value: volume,
                style: {width: '10rem'},
            }),
            IconButton(
                {
                    onclick: () => muted.update((m) => !m),
                },
                () => (muted() ? '🔇' : '🔊'),
            ),
            IconButton(
                {
                    style: {fontSize: '2rem'},
                    onclick: () => onFullscreenToggle(),
                },
                '⛶',
            ),
        ),
    ];
});

const MenuButton = wComponent((w, props: WElementBasicAttributes, children: WChildrenInput) => {
    return w.button({class: 'menu-btn', ...props}, ...children);
});

const IconButton = wComponent((w, props: WElementBasicAttributes, children: WChildrenInput) => {
    return w.button({class: 'icon-btn', ...props}, ...children);
});

interface SliderProps extends WElementBasicAttributes {
    name: string;
    label?: string;
    min?: number;
    max?: number;
    step?: number;
    value?: Signal<number>;
    hideValue?: boolean;
    children?: WChildrenInput;
}

const Slider = wComponent((w, props: SliderProps) => {
    const {
        name,
        label,
        min = 0,
        max = 50,
        step = 1,
        value = signal(0),
        hideValue = false,
        style,
        children = [],
    } = props;
    const inputId = 'slider-volume';

    return [
        w.div(
            {class: 'menu-slider', style},
            w.label({for: inputId}, label),
            w.input({
                id: inputId,
                type: 'range',
                name: name,
                value: value(),
                min: min,
                title: computed(() => value().toString()),
                max: max,
                step: step,
                style: {
                    '--slider-min': `${min}`,
                    '--slider-max': `${max}`,
                    '--slider-value': `${value()}`,
                } as WCssStyleInput,
                oninput: (ev) => {
                    if (!ev.target) return;
                    const input = ev.target as HTMLInputElement;
                    input.style.setProperty('--slider-min', `${min}`);
                    input.style.setProperty('--slider-max', `${max}`);
                    const inputValue = input.valueAsNumber;
                    input.style.setProperty('--slider-value', `${inputValue}`);
                    value.set(inputValue);
                },
            }),

            hideValue ? w.span({}, value) : null,
            ...children,
        ),
    ];
});
