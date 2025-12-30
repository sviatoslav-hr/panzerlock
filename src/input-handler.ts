import {DEV_MODE_KEY} from '#/const';
import {RESTORE_HP_AMOUNT, SHIELD_PICKUP_DURATION} from '#/entity/tank/generation';
import {
  activateTankShield,
  changePlayerDirection,
  restoreTankHealth,
  tryTriggerTankShooting,
} from '#/entity/tank/simulation';
import {GameInput} from '#/input';
import {Direction} from '#/math/direction';
import {Vector2Like} from '#/math/vector';
import {MenuBridge} from '#/menu';
import {
  exitRecording,
  getNextRecordedInput,
  playRecentRecording,
  toggleRecordingEnabledOrStop,
  tryFetchRecording,
} from '#/recording';
import {Renderer} from '#/renderer';
import {GameState, isPaused, isPlaying} from '#/state';
import {DevUI, toggleDevPanelVisibility, toggleFPSVisibility} from '#/ui/dev';
import {notify} from '#/ui/notification';

export interface InputState {
  game: GameInputState;
  extra: ExtraInputState;
}

export interface GameInputState {
  playerDirection?: Direction;
  playerShooting?: boolean;
}

// TODO: There is no point in having input state for extra input since it's not being recorded.
export interface ExtraInputState {
  toggleGamePause?: boolean;
  toggleGamePauseIgnoreMenu?: boolean;
  toggleFullscreen?: boolean;
  toggleMute?: boolean;
  triggerSingleUpdate?: boolean;
  toggleDebugBoundaries?: boolean;
  toggleDevMode?: boolean;
  toggleFPSMonitor?: boolean;
  toggleFPSMonitorPause?: boolean;
  toggleDevPanel?: boolean;
  // TODO: This really should control only dev camera.
  devCameraOffset?: Vector2Like;
  devCameraScaleOffset?: number;
  devCameraScaleMult?: number;
  devCameraScalePrecise?: number;
  devCameraResetToPlayer?: boolean;
  devForceHeal?: boolean;
  devForceShield?: boolean;
  switchDevPlayerCameras?: boolean;
  toggleRecording?: boolean;
  fetchRecording?: boolean;
  playOrExitRecording?: boolean;
  recordingPlayingSpeedMult?: number;
}

export function handleKeymaps(state: GameState, input: GameInput): InputState {
  let gameInput: GameInputState | undefined;
  const extraInput = handleExtraKeymaps(input);
  if (state.recording.playing) {
    gameInput = getNextRecordedInput(state, extraInput.triggerSingleUpdate ?? false) ?? {};
  } else {
    gameInput = handleGameKeymaps(input);
  }
  return {game: gameInput, extra: extraInput};
}

export function handleGameKeymaps(input: GameInput): GameInputState {
  const result: GameInputState = {};
  if (input.isDown('Space')) {
    result.playerShooting = true;
  }
  // NOTE: If player is pressing two opposite direction keys, they should negate each other.
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) {
    result.playerDirection = Direction.WEST;
  }
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) {
    if (result.playerDirection === Direction.WEST) {
      result.playerDirection = undefined;
    } else {
      result.playerDirection = Direction.EAST;
    }
  }
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) {
    result.playerDirection = Direction.NORTH;
  }
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) {
    if (result.playerDirection === Direction.NORTH) {
      result.playerDirection = undefined;
    } else {
      result.playerDirection = Direction.SOUTH;
    }
  }
  return result;
}

export function handleExtraKeymaps(input: GameInput): ExtraInputState {
  const result: ExtraInputState = {};
  const alt = input.isDown('AltLeft'); // NOTE: Alt is used for debug keymaps.
  const shift = input.isDown('ShiftLeft'); // NOTE: Shift is used for alternative actions.

  if (input.isPressed('KeyF')) {
    result.toggleFullscreen = true;
  }

  if (input.isPressed('KeyM')) {
    result.toggleMute = true;
  }

  if (input.isPressed('Escape')) {
    result.toggleGamePause = true;
  } else if (input.isPressed('KeyP')) {
    if (__DEV_MODE && alt) result.toggleGamePauseIgnoreMenu = true;
    else result.toggleGamePause = true;
  }

  if (alt && input.isPressed('Slash')) {
    result.toggleDevMode = true;
  }

  // NOTE: Dev keymaps should only be available in dev mode.
  if (__DEV_MODE && alt) {
    if (input.isPressed('Quote')) {
      result.triggerSingleUpdate = true;
    }

    if (input.isPressed('KeyG')) {
      result.devForceShield = true;
    }

    if (input.isPressed('KeyH')) {
      result.devForceHeal = true;
    }

    if (input.isPressed('KeyB')) {
      result.toggleDebugBoundaries = true;
    }

    if (input.isPressed('KeyU')) {
      result.fetchRecording = true;
    }

    if (input.isPressed('KeyO')) {
      result.toggleRecording = true;
    }

    if (input.isPressed('KeyI')) {
      result.playOrExitRecording = true;
    }

    if (input.isPressed('BracketLeft')) {
      result.recordingPlayingSpeedMult = 0.5;
    } else if (input.isPressed('BracketRight')) {
      result.recordingPlayingSpeedMult = 2;
    }

    if (input.isPressed('Backquote'))
      if (shift) {
        result.toggleFPSMonitorPause = true;
      } else {
        result.toggleFPSMonitor = true;
      }

    if (input.isPressed('Backslash')) {
      result.toggleDevPanel = true;
    }

    if (input.isPressed('KeyC')) {
      result.switchDevPlayerCameras = true;
    }

    if (input.isDown('MouseMiddle') || input.isDown('MouseLeft')) {
      // NOTE: Support also mouse left to have a convenient way to move camera on touchpad
      const delta = input.getMouseDelta();
      if (delta.x !== 0 && delta.y !== 0) {
        result.devCameraOffset = delta;
      }
    }

    if (input.isPressed('Digit0')) {
      result.devCameraResetToPlayer = true;
    } else if (input.isPressed('Digit1')) {
      result.devCameraScalePrecise = 1;
    } else if (input.isPressed('Minus')) {
      result.devCameraScaleMult = 0.5;
    } else if (input.isPressed('Equal')) {
      result.devCameraScaleMult = 2;
    } else if (input.getMouseWheelDelta()) {
      result.devCameraScaleOffset = input.getMouseWheelDelta() * 0.001;
    }
  }

  return result;
}

// TODO: Turn params into an object because it's getting out of hand.
export function processInput(
  input: InputState,
  renderer: Renderer,
  state: GameState,
  menu: MenuBridge,
  devUI: DevUI,
) {
  if (isPlaying(state)) {
    changePlayerDirection(state.player, input.game.playerDirection ?? null);
    if (input.game.playerShooting) {
      tryTriggerTankShooting(state.player, state);
    }
  }

  if (input.extra.toggleFullscreen) {
    renderer
      .toggleFullscreen(window)
      .catch((err) => logger.error('[Input] Failed to toggle fullscreen', err));
  }

  if (input.extra.toggleGamePause || input.extra.toggleGamePauseIgnoreMenu) {
    const isPlayingOrPaused = isPlaying(state) || isPaused(state);
    if (isPlayingOrPaused) {
      const action = isPlaying(state) ? 'pause' : 'resume';
      const ignoreMenu = Boolean(input.extra.toggleGamePauseIgnoreMenu);
      if (ignoreMenu) notify(isPlaying(state) ? 'Paused' : 'Resumed');
      state.events.push({type: 'game-control', action, ignoreMenu});
    } else {
      logger.warn('Game is not in playing state, so we cannot pause/unpause.');
    }
  }

  if (input.extra.toggleMute) {
    // HACK: It's kind of janky to bind this to menu, ideally it should be unrelated, but still updated in the menu.
    //       But this way is simpler, so it's fine for now.
    menu.muted.update((v) => !v);
    notify(`Sound ${menu.muted() ? 'muted' : 'unmuted'}`);
  }

  if (input.extra.triggerSingleUpdate && isPaused(state)) {
    if (menu.visible) {
      menu.view.set(null);
    }
    state.debugUpdateTickTriggered = true;
  }

  if (input.extra.toggleDebugBoundaries) {
    state.debugShowBoundaries = !state.debugShowBoundaries;
  }

  if (input.extra.fetchRecording) {
    tryFetchRecording(state);
  }

  if (input.extra.toggleRecording) {
    toggleRecordingEnabledOrStop(state);
  }

  if (input.extra.playOrExitRecording) {
    if (!state.recording.playing) {
      playRecentRecording(state);
    } else {
      exitRecording(state, menu);
    }
  }

  if (input.extra.recordingPlayingSpeedMult) {
    state.recording.playingSpeedMult *= input.extra.recordingPlayingSpeedMult;
    notify(`${state.recording.playingSpeedMult}x Recording speed`);
  }

  if (input.extra.toggleDevMode) {
    window.__DEV_MODE = !window.__DEV_MODE;
    state.storage.set(DEV_MODE_KEY, window.__DEV_MODE);
    notify(`Dev mode ${window.__DEV_MODE ? 'enabled' : 'disabled'} (x${++devModeCounter})`);
  }

  if (input.extra.toggleFPSMonitor) {
    toggleFPSVisibility(devUI.fpsMonitor, state.storage);
  }
  if (input.extra.toggleFPSMonitorPause) {
    devUI.fpsMonitor.paused = !devUI.fpsMonitor.paused;
  }

  if (input.extra.toggleDevPanel) {
    toggleDevPanelVisibility(devUI.devPanel, state.storage);
  }

  if (input.extra.switchDevPlayerCameras) {
    const {devCamera, playerCamera} = state;
    if (renderer.camera === devCamera) {
      renderer.camera = playerCamera;
      notify('Switched to player camera');
    } else {
      renderer.camera = devCamera;
      notify('Switched to dev camera');
    }
  }

  if (input.extra.devCameraOffset) {
    if (renderer.camera === state.devCamera) {
      const offset = input.extra.devCameraOffset;
      offset.x /= renderer.camera.scale;
      offset.y /= renderer.camera.scale;
      renderer.camera.worldOffset.add(offset);
    } else {
      logger.error('Cannot update offset - dev camera is not active');
    }
  }

  if (input.extra.devCameraScalePrecise != null) {
    if (renderer.camera === state.devCamera) {
      assert(input.extra.devCameraScalePrecise > 0);
      const currentScale = renderer.camera.scale;
      const newScale = input.extra.devCameraScalePrecise;
      const mult = newScale / currentScale;
      input.extra.devCameraScaleMult = mult;
    } else {
      logger.error('Cannot update scale - dev camera is not active');
    }
  }

  if (input.extra.devCameraScaleOffset != null) {
    if (renderer.camera === state.devCamera) {
      renderer.camera = state.devCamera;
      const newScale = renderer.camera.scale - input.extra.devCameraScaleOffset;
      if (Number.isFinite(newScale) && newScale > 0) {
        renderer.camera.setScale(newScale);
      }
    } else {
      logger.error('Cannot update scale - dev camera is not active');
    }
  } else if (input.extra.devCameraScaleMult != null) {
    if (renderer.camera === state.devCamera) {
      renderer.camera = state.devCamera;
      const newScale = renderer.camera.scale * input.extra.devCameraScaleMult;
      renderer.camera.setScale(newScale);
      notify('Set dev camera scale to ' + newScale);
    } else {
      logger.error('Cannot update scale - dev camera is not active');
    }
  }

  if (input.extra.devCameraResetToPlayer) {
    const {devCamera, playerCamera} = state;
    if (renderer.camera === devCamera) {
      devCamera.worldOffset.setFrom(playerCamera.worldOffset);
      devCamera.focusOnRect(state.world.activeRoom.boundary);
    } else {
      logger.error('Cannot reset - dev camera is not active');
    }
  }

  if (input.extra.devForceHeal) {
    notify('Player HP restored');
    restoreTankHealth(state.player, RESTORE_HP_AMOUNT);
  }
  if (input.extra.devForceShield) {
    notify('Player shield activated');
    activateTankShield(state.player, SHIELD_PICKUP_DURATION);
  }
}

let devModeCounter = 0;
