type Difficulty = "easy" | "medium" | "hard" | "nightmare";
type GameMode = "idle" | "countdown" | "playing" | "result";

interface Question {
  displayString: string;
  answer: number;
}

const OP_SYM: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^" };

class QuestionEngine {
  private rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  generate(difficulty: Difficulty): Question {
    switch (difficulty) {
      case "easy":      return this.make(["+", "-"],                2,  20, 1,  20);
      case "medium":    return this.make(["+", "-", "*", "/"],      5,  99, 2,  12);
      case "hard":      return this.make(["+", "-", "*", "/"],     10,  99, 2,  20);
      case "nightmare": return this.make(["+", "-", "*", "/", "^"], 2,  50, 2,   4);
    }
  }

  private make(ops: string[], minA: number, maxA: number, minB: number, maxB: number): Question {
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = 0, b = 0, answer = 0;

    if (op === "^") {
      a = this.rand(2, 9);
      b = this.rand(2, 4);
      answer = Math.pow(a, b);
    } else if (op === "/") {
      // Always clean division: pick divisor then quotient
      b = this.rand(minB, maxB);
      const q = this.rand(2, 20);
      a = b * q;
      answer = q;
    } else {
      a = this.rand(minA, maxA);
      b = this.rand(minB, maxB);
      if (op === "-" && b > a) { const t = a; a = b; b = t; }
      if (op === "+") answer = a + b;
      else if (op === "-") answer = a - b;
      else if (op === "*") answer = a * b;
    }

    return { displayString: `${a} ${OP_SYM[op] ?? op} ${b} = ?`, answer };
  }
}

class ScoreEngine {
  score = 0;
  streak = 0;
  bestStreak = 0;
  correct = 0;
  incorrect = 0;

  get multiplier(): number {
    return Math.min(5, Math.floor(this.streak / 3) + 1);
  }

  recordCorrect(basePoints: number, timeRatio: number): number {
    const speedBonus = Math.floor(basePoints * timeRatio * 0.5);
    const pts = (basePoints + speedBonus) * this.multiplier;
    this.score += pts;
    this.streak++;
    this.correct++;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    return pts;
  }

  recordIncorrect(): void {
    this.streak = 0;
    this.incorrect++;
  }

  reset(): void {
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.correct = 0;
    this.incorrect = 0;
  }
}

class GameController {
  private mode: GameMode = "idle";
  private engine = new QuestionEngine();
  private scoreEngine = new ScoreEngine();
  private currentQuestion: Question | null = null;
  private timerInterval: number | null = null;
  private timeRemaining = 60;
  private totalTime = 60;
  private difficulty: Difficulty = "easy";
  private scoreDisplayValue = 0;
  private scoreAnimFrame: number | null = null;

  // DOM refs
  private gamePanel    = document.getElementById("game-panel")!;
  private playingView  = document.getElementById("playing-view")!;
  private resultView   = document.getElementById("result-view")!;
  private questionText = document.getElementById("question-text")!;
  private feedbackEl   = document.getElementById("feedback-flash")!;
  private scoreEl      = document.getElementById("score-display")!;
  private streakEl     = document.getElementById("streak-display")!;
  private timerText    = document.getElementById("timer-text")!;
  private timerRing    = document.getElementById("timer-ring")!;
  private startBtn     = document.getElementById("start-btn") as HTMLButtonElement;
  private diffSelect   = document.getElementById("difficulty-select") as HTMLSelectElement;
  private countdownEl  = document.getElementById("countdown-overlay")!;
  private highscoreEl  = document.getElementById("highscore-display")!;
  private diffBadge    = document.getElementById("difficulty-badge")!;
  private appWrapper   = document.getElementById("app-wrapper")!;

  constructor() {
    this.startBtn.addEventListener("click", () => {
      if (this.mode === "idle" || this.mode === "result") this.startGame();
      else this.endGame();
    });

    this.diffSelect.addEventListener("change", () => this.updateHighscore());

    // Capture-phase intercept of = button — runs before Calculator's bubble-phase listener
    document.querySelector("[data-action='equals']")!
      .addEventListener("click", (e) => {
        if (this.mode === "playing") { e.stopImmediatePropagation(); this.submitAnswer(); }
      }, true);

    // Capture-phase intercept of Enter/= key
    document.addEventListener("keydown", (e) => {
      if (this.mode === "playing" && (e.key === "Enter" || e.key === "=")) {
        e.stopImmediatePropagation();
        this.submitAnswer();
      }
    }, true);

    this.updateHighscore();
  }

  private startGame(): void {
    this.difficulty = this.diffSelect.value as Difficulty;
    const cfg = this.getConfig();
    this.totalTime = this.timeRemaining = cfg.timeLimit;
    this.scoreEngine.reset();
    this.scoreDisplayValue = 0;
    this.scoreEl.textContent = "0";
    this.streakEl.textContent = "";
    this.timerText.textContent = String(cfg.timeLimit);
    this.timerText.classList.remove("timer-warning");
    this.timerRing.setAttribute("stroke-dashoffset", "0");
    this.timerRing.setAttribute("stroke", "#4CAF50");
    this.diffBadge.textContent = this.difficulty.toUpperCase();
    this.playingView.style.display = "block";
    this.resultView.style.display = "none";
    this.gamePanel.style.display = "block";
    this.appWrapper.classList.add("game-active");
    this.startBtn.textContent = "End Game";
    this.diffSelect.disabled = true;
    this.mode = "countdown";
    this.runCountdown();
  }

  private runCountdown(): void {
    const steps = ["3", "2", "1", "GO!"];
    let i = 0;
    this.countdownEl.style.display = "flex";
    const tick = () => {
      this.countdownEl.textContent = steps[i];
      this.countdownEl.classList.remove("countdown-pop");
      void this.countdownEl.offsetWidth; // force reflow to restart animation
      this.countdownEl.classList.add("countdown-pop");
      i++;
      if (i < steps.length) {
        setTimeout(tick, 700);
      } else {
        setTimeout(() => {
          this.countdownEl.style.display = "none";
          this.beginPlaying();
        }, 650);
      }
    };
    tick();
  }

  private beginPlaying(): void {
    this.mode = "playing";
    this.nextQuestion();
    this.timerInterval = window.setInterval(() => this.tickTimer(), 1000);
  }

  private nextQuestion(): void {
    this.currentQuestion = this.engine.generate(this.difficulty);
    this.questionText.textContent = this.currentQuestion.displayString;
    calculator.clear();
  }

  private submitAnswer(): void {
    if (!this.currentQuestion) return;
    const val = parseFloat(calculator.value);
    const correct = !isNaN(val) && val === this.currentQuestion.answer;

    if (correct) {
      const pts = this.scoreEngine.recordCorrect(
        this.getConfig().basePoints,
        this.timeRemaining / this.totalTime
      );
      this.showFeedback(true, pts);
    } else {
      this.scoreEngine.recordIncorrect();
      this.showFeedback(false, 0);
    }
    this.updateHUD();
    setTimeout(() => { if (this.mode === "playing") this.nextQuestion(); }, 250);
  }

  private showFeedback(correct: boolean, pts: number): void {
    this.feedbackEl.className = "";
    this.feedbackEl.textContent = correct ? `+${pts}` : "WRONG!";
    void this.feedbackEl.offsetWidth;
    this.feedbackEl.className = correct
      ? "feedback-correct feedback-animate"
      : "feedback-wrong feedback-animate";
  }

  private tickTimer(): void {
    this.timeRemaining = Math.max(0, this.timeRemaining - 1);
    const ratio = this.timeRemaining / this.totalTime;
    this.timerRing.setAttribute("stroke-dashoffset", String(138.23 * (1 - ratio)));
    this.timerRing.setAttribute("stroke", ratio > 0.5 ? "#4CAF50" : ratio > 0.2 ? "#f5a623" : "#f44336");
    this.timerText.textContent = String(this.timeRemaining);
    if (this.timeRemaining <= 10) this.timerText.classList.add("timer-warning");
    if (this.timeRemaining <= 0) this.endGame();
  }

  private updateHUD(): void {
    if (this.scoreAnimFrame !== null) cancelAnimationFrame(this.scoreAnimFrame);
    const start = this.scoreDisplayValue;
    const target = this.scoreEngine.score;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 350);
      this.scoreDisplayValue = Math.round(start + (target - start) * t);
      this.scoreEl.textContent = String(this.scoreDisplayValue);
      if (t < 1) this.scoreAnimFrame = requestAnimationFrame(step);
    };
    this.scoreAnimFrame = requestAnimationFrame(step);

    const streak = this.scoreEngine.streak;
    const mult = this.scoreEngine.multiplier;
    if (streak > 0) {
      this.streakEl.textContent = `🔥 ×${mult}`;
      this.streakEl.style.transform = `scale(${Math.min(1.4, 1 + (mult - 1) * 0.1)})`;
    } else {
      this.streakEl.textContent = "";
      this.streakEl.style.transform = "";
    }
  }

  private endGame(): void {
    if (this.timerInterval !== null) { clearInterval(this.timerInterval); this.timerInterval = null; }
    this.mode = "result";
    this.startBtn.textContent = "▶ Play Again";
    this.diffSelect.disabled = false;
    const newBest = this.saveHighScore();
    this.showResult(newBest);
    this.updateHighscore();
  }

  private showResult(newBest: boolean): void {
    const se = this.scoreEngine;
    const total = se.correct + se.incorrect;
    const acc = total > 0 ? Math.round((se.correct / total) * 100) : 0;
    this.playingView.style.display = "none";
    this.resultView.style.display = "flex";
    document.getElementById("result-title")!.textContent = newBest ? "🏆 New Best!" : "Time's Up!";
    document.getElementById("result-score")!.textContent = String(se.score);
    document.getElementById("result-stats")!.innerHTML =
      `<span>${se.correct} correct</span><span>${acc}% acc</span><span>🔥 best ×${se.bestStreak}</span>`;
  }

  private saveHighScore(): boolean {
    const key = `mathBlitz_hs_${this.difficulty}`;
    const prev = parseInt(localStorage.getItem(key) ?? "0");
    if (this.scoreEngine.score > prev) {
      localStorage.setItem(key, String(this.scoreEngine.score));
      return true;
    }
    return false;
  }

  private updateHighscore(): void {
    const diff = (this.diffSelect.value || "easy") as Difficulty;
    const hs = parseInt(localStorage.getItem(`mathBlitz_hs_${diff}`) ?? "0");
    this.highscoreEl.textContent = hs > 0 ? `Best: ${hs}` : "";
  }

  private getConfig(): { basePoints: number; timeLimit: number } {
    const cfgs: Record<Difficulty, { basePoints: number; timeLimit: number }> = {
      easy:      { basePoints: 50,  timeLimit: 60 },
      medium:    { basePoints: 100, timeLimit: 60 },
      hard:      { basePoints: 200, timeLimit: 60 },
      nightmare: { basePoints: 400, timeLimit: 30 },
    };
    return cfgs[this.difficulty];
  }
}

new GameController();
