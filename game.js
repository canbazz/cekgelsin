const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlayDescEl = document.getElementById("overlayDesc");
const startBtn = document.getElementById("startBtn");
const shareBtn = document.getElementById("shareBtn");
const quizEl = document.getElementById("quiz");
const quizQuestionEl = document.getElementById("quizQuestion");
const quizAnswerEl = document.getElementById("quizAnswer");
const quizErrorEl = document.getElementById("quizError");
const deathSound = new Audio("death.mp3");
const homeSound = new Audio("home.mp3");
const errorSound = new Audio("hata.mp3");
const shareSound = new Audio("paylas.mp3");
const correctSound = new Audio("dogru.mp3");
const bgMusic = new Audio("cendere.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.2;

const rand = (min, max) => Math.random() * (max - min) + min;

const state = {
  running: false,
  time: 0,
  score: 0,
  best: Number(localStorage.getItem("runner-best") || 0),
  groundY: 300,
  platformHeight: 22,
  phase: "idle",
  platforms: [],
  currentIndex: 0,
  clouds: [],
  stars: [],
  shake: 0,
  falling: false,
  paused: false,
  quizMode: "none",
  autoScrollSpeed: 0.02,
};

const player = {
  size: 34,
  x: 0,
  y: 0,
  color: "#34c1ff",
  fallY: 0,
};

const stick = {
  x: 0,
  y: 0,
  length: 0,
  angle: 0,
};

const controls = {
  growHeld: false,
};

let quiz = {
  a: 0,
  b: 0,
  op: "+",
  answer: 0,
};

function resetStageForNextRun() {
  state.platforms = createInitialPlatforms();
  state.currentIndex = 0;
  setupPlayerOnPlatform();
  state.clouds = Array.from({ length: 6 }, () => createCloud(true));
  state.stars = Array.from({ length: 30 }, createStar);
  state.shake = 0;
  state.falling = false;
  state.phase = "idle";
  stick.length = 0;
  stick.angle = 0;
}

function generateQuiz() {
  const useAdd = Math.random() > 0.4;
  if (useAdd) {
    quiz.a = Math.floor(rand(5, 30));
    quiz.b = Math.floor(rand(5, 30));
    quiz.op = "+";
    quiz.answer = quiz.a + quiz.b;
  } else {
    quiz.a = Math.floor(rand(20, 50));
    quiz.b = Math.floor(rand(1, 19));
    quiz.op = "-";
    if (quiz.b > quiz.a) [quiz.a, quiz.b] = [quiz.b, quiz.a];
    quiz.answer = quiz.a - quiz.b;
  }
  quizQuestionEl.textContent = `${quiz.a} ${quiz.op} ${quiz.b} = ?`;
  quizAnswerEl.value = "";
  quizErrorEl.textContent = "";
}

bestEl.textContent = state.best;

function resetGame() {
  state.running = true;
  state.time = performance.now();
  state.score = 0;
  state.paused = false;
  state.quizMode = "none";
  resetStageForNextRun();
  overlayTitleEl.textContent = "Koşucu";
  overlayDescEl.textContent = "Basılı tut: küp uzar. Bırak: yana devrilir.";
  startBtn.textContent = "Başlat";
  shareBtn.style.display = "none";
  quizEl.style.display = "none";
  quizAnswerEl.disabled = false;
  overlayEl.classList.add("hidden");
  drawScore();
}

function endGame() {
  state.running = false;
  state.paused = false;
  state.quizMode = "restart";
  deathSound.currentTime = 0;
  deathSound.play().catch(err => console.log("Death sound failed:", err));
  overlayTitleEl.textContent = "Kaybettiniz";
  overlayDescEl.textContent = `Skorun: ${Math.floor(state.score)}`;
  startBtn.textContent = "Yeniden Başla";
  shareBtn.style.display = "inline-flex";
  quizEl.style.display = "block";
  generateQuiz();
  overlayEl.classList.remove("hidden");
  if (state.score > state.best) {
    state.best = Math.floor(state.score);
    localStorage.setItem("runner-best", state.best);
    bestEl.textContent = state.best;
  }
  resetStageForNextRun();
}

function createPlatform(startX) {
  const gap = rand(70, 170);
  const width = rand(90, 220);
  return {
    x: startX + gap,
    w: width,
  };
}

function createInitialPlatforms() {
  const platforms = [{ x: 0, w: 200 }];
  while (platforms.length < 5) {
    const last = platforms[platforms.length - 1];
    platforms.push(createPlatform(last.x + last.w));
  }
  return platforms;
}

function createCloud(initial = false) {
  return {
    x: initial ? rand(0, canvas.width) : canvas.width + rand(0, 200),
    y: rand(40, 160),
    w: rand(80, 160),
    speed: rand(0.1, 0.35),
  };
}

function createStar() {
  return {
    x: rand(0, canvas.width),
    y: rand(20, 200),
    r: rand(0.8, 1.6),
    alpha: rand(0.3, 0.8),
  };
}

function setupPlayerOnPlatform() {
  const platform = state.platforms[state.currentIndex];
  player.x = platform.x + platform.w - player.size;
  player.y = state.groundY - state.platformHeight - player.size;
  player.fallY = player.y;

  stick.x = platform.x + platform.w;
  stick.y = state.groundY - state.platformHeight;
  stick.length = 0;
  stick.angle = 0;
}

function updateClouds() {
  state.clouds.forEach((cloud) => {
    cloud.x -= cloud.speed;
  });
  state.clouds = state.clouds.filter((cloud) => cloud.x + cloud.w > -60);
  while (state.clouds.length < 6) {
    state.clouds.push(createCloud());
  }
}

function currentPlatform() {
  return state.platforms[state.currentIndex];
}

function nextPlatform() {
  return state.platforms[state.currentIndex + 1];
}

function startGrowing() {
  if (!state.running) {
    resetGame();
    return;
  }
  if (state.paused) return;
  if (state.phase !== "idle") return;
  state.phase = "growing";
  controls.growHeld = true;
}

function stopGrowing() {
  if (state.phase !== "growing") return;
  state.phase = "falling";
  controls.growHeld = false;
}

function resolveStick() {
  const current = currentPlatform();
  const next = nextPlatform();
  if (!next) return false;
  const gap = next.x - (current.x + current.w);
  const reach = stick.length;
  const success = reach >= gap && reach <= gap + next.w;

  if (success) {
    player.x = next.x + next.w - player.size;
    state.currentIndex += 1;
    state.score += 1;
    drawScore();
    if (state.score % 4 === 0) {
      state.phase = "idle";
      showContinueQuiz();
    } else {
      state.phase = "shifting";
    }
  } else {
    state.phase = "falling-down";
    state.falling = true;
    player.fallY = player.y;
  }
  return success;
}

function showContinueQuiz() {
  state.paused = true;
  state.quizMode = "continue";
  overlayTitleEl.textContent = "Devam etmek için çöz";
  overlayDescEl.textContent = "4 hamlede bir küçük soru.";
  startBtn.textContent = "Devam Et";
  shareBtn.style.display = "none";
  quizEl.style.display = "block";
  generateQuiz();
  overlayEl.classList.remove("hidden");
}

function drawBackground() {
  ctx.fillStyle = "#0c111a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  state.stars.forEach((star) => {
    ctx.globalAlpha = star.alpha;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  state.clouds.forEach((cloud) => {
    ctx.beginPath();
    ctx.ellipse(cloud.x, cloud.y, cloud.w * 0.4, cloud.w * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#0f1b2a";
  ctx.fillRect(0, state.groundY + 4, canvas.width, canvas.height - state.groundY);
}

function drawPlatforms() {
  const top = state.groundY - state.platformHeight;
  state.platforms.forEach((platform) => {
    ctx.fillStyle = "#1b2636";
    ctx.fillRect(platform.x, top, platform.w, state.platformHeight + 6);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(platform.x + 4, top + 4, platform.w - 8, state.platformHeight - 2);
  });
}

function drawStick() {
  if (stick.length <= 0 && state.phase === "idle") return;
  const towerLength = player.size + stick.length;
  ctx.save();
  ctx.translate(stick.x, stick.y);
  ctx.rotate(stick.angle);
  ctx.fillStyle = player.color;
  ctx.fillRect(-player.size, -towerLength, player.size, towerLength);
  ctx.restore();
}

function drawPlayer() {
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.size, player.size);

  ctx.fillStyle = "#02131f";
  ctx.fillRect(player.x + 9, player.y + 9, 8, 8);
}

function drawScore() {
  scoreEl.textContent = Math.floor(state.score);
}

function update(timestamp) {
  const delta = timestamp - state.time;
  state.time = timestamp;

  if (state.running && !state.paused) {
    updateClouds();

    if (["idle", "growing", "falling"].includes(state.phase)) {
      const drift = delta * state.autoScrollSpeed;
      state.platforms.forEach((platform) => {
        platform.x -= drift;
      });
      stick.x -= drift;
      player.x -= drift;
    }

    if (state.phase === "growing") {
      stick.length += delta * 0.08;
      stick.length = Math.min(stick.length, 320);
    }

    if (state.phase === "falling") {
      stick.angle += delta * 0.008;
      if (stick.angle >= Math.PI / 2) {
        stick.angle = Math.PI / 2;
        resolveStick();
      }
    }

    if (state.phase === "shifting") {
      const baseX = 120;
      const current = currentPlatform();
      const desired = current.x + current.w - player.size;
      const offset = desired - baseX;
      const shift = Math.sign(offset) * Math.min(Math.abs(offset), delta * 0.2);
      state.platforms.forEach((platform) => {
        platform.x -= shift;
      });
      player.x -= shift;

      if (Math.abs(offset) <= 0.5) {
        const last = state.platforms[state.platforms.length - 1];
        if (last.x + last.w < canvas.width + 220) {
          state.platforms.push(createPlatform(last.x + last.w));
        }
        while (state.platforms[0].x + state.platforms[0].w < -120) {
          state.platforms.shift();
          state.currentIndex = Math.max(0, state.currentIndex - 1);
        }
        setupPlayerOnPlatform();
        state.phase = "idle";
      }
    }

    if (state.phase === "falling-down") {
      player.fallY += delta * 0.22;
      const targetFall = state.groundY + 30;
      if (player.fallY >= targetFall) {
        player.fallY = targetFall;
        stick.length = 0;
        stick.angle = 0;
        state.phase = "fallen";
        endGame();
      }
    }
  }

  render();
  requestAnimationFrame(update);
}

function render() {
  if (state.shake > 0) {
    state.shake -= 1;
    ctx.save();
    ctx.translate(rand(-2, 2), rand(-2, 2));
  }

  drawBackground();
  drawPlatforms();
  drawStick();

  if (state.phase === "growing" || state.phase === "falling") {
    // Uzayan küp stick ile çiziliyor
  } else if (state.phase === "falling-down" || state.phase === "fallen") {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.fallY, player.size, player.size);
  } else {
    drawPlayer();
  }

  drawScore();

  if (state.shake > 0) {
    ctx.restore();
  }
}

function handleKeyDown(event) {
  if (event.code === "Space") {
    event.preventDefault();
    startGrowing();
  }
}

function handleKeyUp(event) {
  if (event.code === "Space") {
    event.preventDefault();
    stopGrowing();
  }
}

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  startGrowing();
});
canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
  stopGrowing();
});

startBtn.addEventListener("click", () => {
  if (state.quizMode !== "none") {
    const userAnswer = Number(quizAnswerEl.value);
    if (!Number.isFinite(userAnswer) || userAnswer !== quiz.answer) {
      quizErrorEl.textContent = "Yanlış cevap. Tekrar dene.";
      quizAnswerEl.focus();
      errorSound.currentTime = 0;
      errorSound.play().catch(err => console.log("Error sound failed:", err));
      return;
    }
    correctSound.currentTime = 0;
    correctSound.play().catch(err => console.log("Correct sound failed:", err));
  }

  if (state.quizMode === "continue") {
    state.paused = false;
    state.quizMode = "none";
    overlayEl.classList.add("hidden");
    return;
  }

  resetGame();
});
shareBtn.addEventListener("click", async () => {
  shareSound.currentTime = 0;
  shareSound.play().catch(err => console.log("Share sound failed:", err));
  const score = Math.floor(state.score);
  const text = `Skorum ${score}! Daha iyisini yapabilir misin?`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Koşucu", text });
      return;
    } catch (error) {
      // Paylaşım iptal edildiyse sessizce geç
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    overlayDescEl.textContent = "Skorun kopyalandı!";
  } catch (error) {
    overlayDescEl.textContent = text;
  }
});

requestAnimationFrame(update);

let audioUnlocked = false;

function playHomeSound() {
  homeSound.currentTime = 0;
  homeSound.play().catch(err => console.log("Home sound failed:", err));
}

function unlockAudio() {
  if (audioUnlocked) return;
  
  homeSound.play().then(() => {
    console.log("Home sound unlocked!");
    homeSound.currentTime = 0;
  }).catch(err => console.log("Home sound failed:", err));
  
  bgMusic.play().then(() => {
    console.log("Background music started!");
  }).catch(err => console.log("Background music failed:", err));
  
  audioUnlocked = true;
}

window.addEventListener("load", unlockAudio);
canvas.addEventListener("pointerdown", unlockAudio, { once: true });
canvas.addEventListener("touchstart", unlockAudio, { once: true });
startBtn.addEventListener("click", unlockAudio, { once: true });
