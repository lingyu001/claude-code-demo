"use strict";
const OP_SYM = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^" };
class QuestionEngine {
    rand(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    generate(difficulty) {
        switch (difficulty) {
            case "easy": return this.make(["+", "-"], 2, 20, 1, 20);
            case "medium": return this.make(["+", "-", "*", "/"], 5, 99, 2, 12);
            case "hard": return this.make(["+", "-", "*", "/"], 10, 99, 2, 20);
            case "nightmare": return this.make(["+", "-", "*", "/", "^"], 2, 50, 2, 4);
        }
    }
    make(ops, minA, maxA, minB, maxB) {
        var _a;
        const op = ops[Math.floor(Math.random() * ops.length)];
        let a = 0, b = 0, answer = 0;
        if (op === "^") {
            a = this.rand(2, 9);
            b = this.rand(2, 4);
            answer = Math.pow(a, b);
        }
        else if (op === "/") {
            // Always clean division: pick divisor then quotient
            b = this.rand(minB, maxB);
            const q = this.rand(2, 20);
            a = b * q;
            answer = q;
        }
        else {
            a = this.rand(minA, maxA);
            b = this.rand(minB, maxB);
            if (op === "-" && b > a) {
                const t = a;
                a = b;
                b = t;
            }
            if (op === "+")
                answer = a + b;
            else if (op === "-")
                answer = a - b;
            else if (op === "*")
                answer = a * b;
        }
        return { displayString: `${a} ${(_a = OP_SYM[op]) !== null && _a !== void 0 ? _a : op} ${b} = ?`, answer };
    }
}
class ScoreEngine {
    constructor() {
        this.score = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.correct = 0;
        this.incorrect = 0;
    }
    get multiplier() {
        return Math.min(5, Math.floor(this.streak / 3) + 1);
    }
    recordCorrect(basePoints, timeRatio) {
        const speedBonus = Math.floor(basePoints * timeRatio * 0.5);
        const pts = (basePoints + speedBonus) * this.multiplier;
        this.score += pts;
        this.streak++;
        this.correct++;
        if (this.streak > this.bestStreak)
            this.bestStreak = this.streak;
        return pts;
    }
    recordIncorrect() {
        this.streak = 0;
        this.incorrect++;
    }
    reset() {
        this.score = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.correct = 0;
        this.incorrect = 0;
    }
}
class GameController {
    constructor() {
        this.mode = "idle";
        this.engine = new QuestionEngine();
        this.scoreEngine = new ScoreEngine();
        this.currentQuestion = null;
        this.timerInterval = null;
        this.timeRemaining = 60;
        this.totalTime = 60;
        this.difficulty = "easy";
        this.scoreDisplayValue = 0;
        this.scoreAnimFrame = null;
        // DOM refs
        this.gamePanel = document.getElementById("game-panel");
        this.playingView = document.getElementById("playing-view");
        this.resultView = document.getElementById("result-view");
        this.questionText = document.getElementById("question-text");
        this.feedbackEl = document.getElementById("feedback-flash");
        this.scoreEl = document.getElementById("score-display");
        this.streakEl = document.getElementById("streak-display");
        this.timerText = document.getElementById("timer-text");
        this.timerRing = document.getElementById("timer-ring");
        this.startBtn = document.getElementById("start-btn");
        this.diffSelect = document.getElementById("difficulty-select");
        this.countdownEl = document.getElementById("countdown-overlay");
        this.highscoreEl = document.getElementById("highscore-display");
        this.diffBadge = document.getElementById("difficulty-badge");
        this.appWrapper = document.getElementById("app-wrapper");
        this.startBtn.addEventListener("click", () => {
            if (this.mode === "idle" || this.mode === "result")
                this.startGame();
            else
                this.endGame();
        });
        this.diffSelect.addEventListener("change", () => this.updateHighscore());
        // Capture-phase intercept of = button — runs before Calculator's bubble-phase listener
        document.querySelector("[data-action='equals']")
            .addEventListener("click", (e) => {
            if (this.mode === "playing") {
                e.stopImmediatePropagation();
                this.submitAnswer();
            }
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
    startGame() {
        this.difficulty = this.diffSelect.value;
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
    runCountdown() {
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
            }
            else {
                setTimeout(() => {
                    this.countdownEl.style.display = "none";
                    this.beginPlaying();
                }, 650);
            }
        };
        tick();
    }
    beginPlaying() {
        this.mode = "playing";
        this.nextQuestion();
        this.timerInterval = window.setInterval(() => this.tickTimer(), 1000);
    }
    nextQuestion() {
        this.currentQuestion = this.engine.generate(this.difficulty);
        this.questionText.textContent = this.currentQuestion.displayString;
        calculator.clear();
    }
    submitAnswer() {
        if (!this.currentQuestion)
            return;
        const val = parseFloat(calculator.value);
        const correct = !isNaN(val) && val === this.currentQuestion.answer;
        if (correct) {
            const pts = this.scoreEngine.recordCorrect(this.getConfig().basePoints, this.timeRemaining / this.totalTime);
            this.showFeedback(true, pts);
        }
        else {
            this.scoreEngine.recordIncorrect();
            this.showFeedback(false, 0);
        }
        this.updateHUD();
        setTimeout(() => { if (this.mode === "playing")
            this.nextQuestion(); }, 250);
    }
    showFeedback(correct, pts) {
        this.feedbackEl.className = "";
        this.feedbackEl.textContent = correct ? `+${pts}` : "WRONG!";
        void this.feedbackEl.offsetWidth;
        this.feedbackEl.className = correct
            ? "feedback-correct feedback-animate"
            : "feedback-wrong feedback-animate";
    }
    tickTimer() {
        this.timeRemaining = Math.max(0, this.timeRemaining - 1);
        const ratio = this.timeRemaining / this.totalTime;
        this.timerRing.setAttribute("stroke-dashoffset", String(138.23 * (1 - ratio)));
        this.timerRing.setAttribute("stroke", ratio > 0.5 ? "#4CAF50" : ratio > 0.2 ? "#f5a623" : "#f44336");
        this.timerText.textContent = String(this.timeRemaining);
        if (this.timeRemaining <= 10)
            this.timerText.classList.add("timer-warning");
        if (this.timeRemaining <= 0)
            this.endGame();
    }
    updateHUD() {
        if (this.scoreAnimFrame !== null)
            cancelAnimationFrame(this.scoreAnimFrame);
        const start = this.scoreDisplayValue;
        const target = this.scoreEngine.score;
        const t0 = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - t0) / 350);
            this.scoreDisplayValue = Math.round(start + (target - start) * t);
            this.scoreEl.textContent = String(this.scoreDisplayValue);
            if (t < 1)
                this.scoreAnimFrame = requestAnimationFrame(step);
        };
        this.scoreAnimFrame = requestAnimationFrame(step);
        const streak = this.scoreEngine.streak;
        const mult = this.scoreEngine.multiplier;
        if (streak > 0) {
            this.streakEl.textContent = `🔥 ×${mult}`;
            this.streakEl.style.transform = `scale(${Math.min(1.4, 1 + (mult - 1) * 0.1)})`;
        }
        else {
            this.streakEl.textContent = "";
            this.streakEl.style.transform = "";
        }
    }
    endGame() {
        if (this.timerInterval !== null) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.mode = "result";
        this.startBtn.textContent = "▶ Play Again";
        this.diffSelect.disabled = false;
        const newBest = this.saveHighScore();
        this.showResult(newBest);
        this.updateHighscore();
    }
    showResult(newBest) {
        const se = this.scoreEngine;
        const total = se.correct + se.incorrect;
        const acc = total > 0 ? Math.round((se.correct / total) * 100) : 0;
        this.playingView.style.display = "none";
        this.resultView.style.display = "flex";
        document.getElementById("result-title").textContent = newBest ? "🏆 New Best!" : "Time's Up!";
        document.getElementById("result-score").textContent = String(se.score);
        document.getElementById("result-stats").innerHTML =
            `<span>${se.correct} correct</span><span>${acc}% acc</span><span>🔥 best ×${se.bestStreak}</span>`;
    }
    saveHighScore() {
        var _a;
        const key = `mathBlitz_hs_${this.difficulty}`;
        const prev = parseInt((_a = localStorage.getItem(key)) !== null && _a !== void 0 ? _a : "0");
        if (this.scoreEngine.score > prev) {
            localStorage.setItem(key, String(this.scoreEngine.score));
            return true;
        }
        return false;
    }
    updateHighscore() {
        var _a;
        const diff = (this.diffSelect.value || "easy");
        const hs = parseInt((_a = localStorage.getItem(`mathBlitz_hs_${diff}`)) !== null && _a !== void 0 ? _a : "0");
        this.highscoreEl.textContent = hs > 0 ? `Best: ${hs}` : "";
    }
    getConfig() {
        const cfgs = {
            easy: { basePoints: 50, timeLimit: 60 },
            medium: { basePoints: 100, timeLimit: 60 },
            hard: { basePoints: 200, timeLimit: 60 },
            nightmare: { basePoints: 400, timeLimit: 30 },
        };
        return cfgs[this.difficulty];
    }
}
new GameController();
