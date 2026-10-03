(() => {
  'use strict';

  const levels = {
    easy: { speed: 680, pause: 260 },
    medium: { speed: 460, pause: 170 },
    difficult: { speed: 300, pause: 100 }
  };
  const tiles = [...document.querySelectorAll('.tile')];
  const levelButtons = [...document.querySelectorAll('.level')];
  const startButton = document.querySelector('#start');
  const pauseButton = document.querySelector('#pause');
  const stopButton = document.querySelector('#stop');
  const message = document.querySelector('#message');
  const roundDisplay = document.querySelector('#round');
  const bestDisplay = document.querySelector('#best');
  const track = document.querySelector('#track');

  const state = {
    level: 'easy',
    sequence: [],
    inputIndex: 0,
    round: 0,
    active: false,
    showing: false,
    acceptingInput: false,
    paused: false,
    runId: 0,
    best: 0
  };

  try {
    state.best = Number(localStorage.getItem('color-memory-best')) || 0;
  } catch (error) {
    state.best = 0;
  }
  bestDisplay.textContent = String(state.best).padStart(2, '0');

  function isCurrentRun(runId) {
    return state.active && state.runId === runId;
  }

  function say(text, playing = false) {
    message.lastElementChild.textContent = text;
    message.querySelector('.lamp').classList.toggle('playing', playing);
  }

  function updateTrack() {
    track.replaceChildren();
    const fill = document.createElement('i');
    fill.style.width = `${Math.min((state.round / 50) * 100, 100)}%`;
    track.append(fill);
  }

  function setTilesDisabled(disabled) {
    tiles.forEach(tile => { tile.disabled = disabled; });
  }

  async function wait(milliseconds, runId) {
    let remaining = milliseconds;
    while (remaining > 0) {
      while (state.paused && isCurrentRun(runId)) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      if (!isCurrentRun(runId)) return false;
      const step = Math.min(35, remaining);
      await new Promise(resolve => setTimeout(resolve, step));
      remaining -= step;
    }
    return isCurrentRun(runId);
  }

  async function flash(index, duration, runId) {
    const tile = tiles[index];
    tile.classList.add('lit');
    const finishedFlash = await wait(duration, runId);
    tile.classList.remove('lit');
    if (!finishedFlash) return false;
    return wait(levels[state.level].pause, runId);
  }

  async function playSequence(runId) {
    state.showing = true;
    state.acceptingInput = false;
    setTilesDisabled(true);
    say('👀 Watch carefully…', true);

    if (!await wait(400, runId)) return;
    for (const color of state.sequence) {
      if (!await flash(color, levels[state.level].speed, runId)) return;
    }

    if (!isCurrentRun(runId)) return;
    state.showing = false;
    state.acceptingInput = true;
    setTilesDisabled(state.paused);
    say('👉 Your turn — repeat it!');
  }

  async function nextRound(runId) {
    if (!isCurrentRun(runId)) return;
    state.round += 1;
    state.sequence.push(Math.floor(Math.random() * tiles.length));
    state.inputIndex = 0;
    roundDisplay.textContent = String(state.round).padStart(2, '0');
    updateTrack();
    await playSequence(runId);
  }

  function finish(won) {
    state.active = false;
    state.runId += 1;
    state.showing = false;
    state.acceptingInput = false;
    state.paused = false;
    pauseButton.disabled = true;
    pauseButton.textContent = 'Ⅱ Pause';
    stopButton.disabled = true;
    setTilesDisabled(true);
    tiles.forEach(tile => tile.classList.remove('lit'));
    startButton.disabled = false;
    startButton.innerHTML = won ? '🏆 &nbsp; Play again' : '↻ &nbsp; Try again';
    say(won
      ? `🎉 Amazing! You completed all ${state.round} levels!`
      : `Game over — you reached level ${state.round}. Try again?`);
  }

  function saveBestIfNeeded() {
    if (state.round <= state.best) return;
    state.best = state.round;
    bestDisplay.textContent = String(state.best).padStart(2, '0');
    try {
      localStorage.setItem('color-memory-best', String(state.best));
    } catch (error) {
      // The game remains playable if browser storage is unavailable.
    }
  }

  levelButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (state.active) return;
      state.level = button.dataset.level;
      levelButtons.forEach(item => {
        const selected = item === button;
        item.classList.toggle('selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      say(`${button.textContent} mode selected`);
    });
  });

  startButton.addEventListener('click', async () => {
    if (state.active) return;
    state.runId += 1;
    const runId = state.runId;
    state.sequence = [];
    state.inputIndex = 0;
    state.round = 0;
    state.active = true;
    state.showing = false;
    state.acceptingInput = false;
    state.paused = false;
    pauseButton.disabled = false;
    pauseButton.textContent = 'Ⅱ Pause';
    stopButton.disabled = false;
    setTilesDisabled(true);
    roundDisplay.textContent = '00';
    updateTrack();
    startButton.disabled = true;
    startButton.textContent = 'Get ready…';
    await nextRound(runId);
  });

  pauseButton.addEventListener('click', () => {
    if (!state.active) return;
    state.paused = !state.paused;
    pauseButton.textContent = state.paused ? '▶ Resume' : 'Ⅱ Pause';
    setTilesDisabled(state.paused || state.showing || !state.acceptingInput);
    if (state.paused) {
      say('⏸ Paused');
    } else if (state.showing) {
      say('👀 Resuming sequence…', true);
    } else if (state.acceptingInput) {
      say('👉 Your turn — repeat it!');
    } else {
      say('▶ Resuming…', true);
    }
  });

  stopButton.addEventListener('click', () => {
    if (!state.active) return;
    state.active = false;
    state.runId += 1;
    state.paused = false;
    state.showing = false;
    state.acceptingInput = false;
    pauseButton.disabled = true;
    pauseButton.textContent = 'Ⅱ Pause';
    stopButton.disabled = true;
    setTilesDisabled(true);
    tiles.forEach(tile => tile.classList.remove('lit'));
    startButton.disabled = false;
    startButton.innerHTML = '▶ &nbsp; Start game';
    say('⏹ Game stopped. Ready when you are!');
  });

  tiles.forEach(tile => {
    tile.addEventListener('click', async () => {
      if (!state.active || state.paused || state.showing || !state.acceptingInput || tile.disabled) return;
      const runId = state.runId;
      const choice = Number(tile.dataset.tile);
      tile.classList.add('lit');
      setTimeout(() => tile.classList.remove('lit'), 180);

      if (choice !== state.sequence[state.inputIndex]) {
        finish(false);
        return;
      }

      state.inputIndex += 1;
      if (state.inputIndex !== state.sequence.length) return;

      state.acceptingInput = false;
      setTilesDisabled(true);
      saveBestIfNeeded();
      if (state.round === 50) {
        finish(true);
        return;
      }

      say('⭐ Great! Next pattern…', true);
      if (await wait(650, runId) && isCurrentRun(runId)) {
        await nextRound(runId);
      }
    });
  });
})();
