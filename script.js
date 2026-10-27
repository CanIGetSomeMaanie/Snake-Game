"use strict";

// ========================================
// 1. GET THE HTML ELEMENTS
// ========================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreDisplay = document.getElementById("score");
const bestScoreDisplay = document.getElementById("bestScore");
const gameStatus = document.getElementById("gameStatus");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const startButton = document.getElementById("startButton");

const leaderboard = document.getElementById("leaderboard");
const playerFormSection = document.getElementById("playerFormSection");
const playerForm = document.getElementById("playerForm");
const playerName = document.getElementById("playerName");
const playerEmail = document.getElementById("playerEmail");
const formError = document.getElementById("formError");

// ========================================
// 2. GAME SETTINGS
// ========================================

const CELL_SIZE = 20;
const CELL_COUNT = canvas.width / CELL_SIZE;
const POINTS_PER_FOOD = 10;

// Higher numbers make the snake move more slowly.
const GAME_SPEED = 180;

const STORAGE_KEY = "snakeArcadeTopScores";

let snake = [];
let food = { x: 15, y: 10 };

let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };

let score = 0;
let gameState = "ready";
let lastFrameTime = null;
let timeSinceMove = 0;
let pendingScore = null;

// ========================================
// 3. LOAD AND SAVE THE LEADERBOARD
// ========================================

function loadScores() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return [];
        }

        const parsed = JSON.parse(saved);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter(entry =>
                entry &&
                typeof entry.name === "string" &&
                typeof entry.score === "number" &&
                Number.isFinite(entry.score) &&
                entry.score >= 0
            )
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    } catch (error) {
        console.error("Unable to load scores:", error);
        return [];
    }
}

let highScores = loadScores();

function saveScores() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(highScores)
        );
    } catch (error) {
        console.error("Unable to save scores:", error);
    }
}

function renderLeaderboard() {
    leaderboard.replaceChildren();

    if (highScores.length === 0) {
        const item = document.createElement("li");
        item.className = "empty-score";
        item.textContent = "No scores yet. Be the first!";
        leaderboard.appendChild(item);
    } else {
        highScores.forEach(entry => {
            const item = document.createElement("li");
            const row = document.createElement("div");
            const name = document.createElement("span");
            const points = document.createElement("strong");

            row.className = "score-entry";
            name.textContent = entry.name;
            points.textContent = String(entry.score);

            row.append(name, points);
            item.appendChild(row);
            leaderboard.appendChild(item);
        });
    }

    bestScoreDisplay.textContent = highScores.length
        ? String(highScores[0].score)
        : "0";
}

function qualifiesForTopFive(finalScore) {
    return highScores.length < 5 ||
        finalScore > highScores[highScores.length - 1].score;
}

// ========================================
// 4. RESET AND START THE GAME
// ========================================

function resetGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];

    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };

    score = 0;
    timeSinceMove = 0;

    scoreDisplay.textContent = "0";
    gameStatus.textContent = "READY TO PLAY";

    playerFormSection.hidden = true;
    playerForm.reset();
    formError.textContent = "";
    pendingScore = null;

    placeFood();
    drawGame();
}

function startGame() {
    resetGame();

    gameState = "playing";
    overlay.hidden = true;
    gameStatus.textContent = "PLAYING";
}

function placeFood() {
    const emptyCells = [];

    for (let y = 0; y < CELL_COUNT; y++) {
        for (let x = 0; x < CELL_COUNT; x++) {
            const occupied = snake.some(segment =>
                segment.x === x && segment.y === y
            );

            if (!occupied) {
                emptyCells.push({ x, y });
            }
        }
    }

    if (emptyCells.length === 0) {
        finishGame(true);
        return;
    }

    food = emptyCells[
        Math.floor(Math.random() * emptyCells.length)
    ];
}

// ========================================
// 5. DRAW THE GAME
// ========================================

function drawGame() {
    ctx.fillStyle = "#101a10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the grid.
    ctx.strokeStyle = "#1b291b";
    ctx.lineWidth = 1;

    for (let position = 0;
        position <= canvas.width;
        position += CELL_SIZE) {

        ctx.beginPath();
        ctx.moveTo(position, 0);
        ctx.lineTo(position, canvas.height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, position);
        ctx.lineTo(canvas.width, position);
        ctx.stroke();
    }

    // Draw the food.
    ctx.fillStyle = "#ff5555";
    ctx.beginPath();
    ctx.arc(
        food.x * CELL_SIZE + CELL_SIZE / 2,
        food.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE * 0.36,
        0,
        Math.PI * 2
    );
    ctx.fill();

    // Draw the snake.
    snake.forEach((segment, index) => {
        const inset = 2;

        ctx.fillStyle = index === 0
            ? "#b5ff82"
            : "#65d83d";

        ctx.beginPath();

        if (typeof ctx.roundRect === "function") {
            ctx.roundRect(
                segment.x * CELL_SIZE + inset,
                segment.y * CELL_SIZE + inset,
                CELL_SIZE - inset * 2,
                CELL_SIZE - inset * 2,
                5
            );
        } else {
            ctx.rect(
                segment.x * CELL_SIZE + inset,
                segment.y * CELL_SIZE + inset,
                CELL_SIZE - inset * 2,
                CELL_SIZE - inset * 2
            );
        }

        ctx.fill();
    });

    // Draw the eyes.
    const head = snake[0];

    if (head) {
        const centerX = head.x * CELL_SIZE + CELL_SIZE / 2;
        const centerY = head.y * CELL_SIZE + CELL_SIZE / 2;

        let eye1;
        let eye2;

        if (direction.x !== 0) {
            eye1 = {
                x: centerX + direction.x * 4,
                y: centerY - 4
            };

            eye2 = {
                x: centerX + direction.x * 4,
                y: centerY + 4
            };
        } else {
            eye1 = {
                x: centerX - 4,
                y: centerY + direction.y * 4
            };

            eye2 = {
                x: centerX + 4,
                y: centerY + direction.y * 4
            };
        }

        ctx.fillStyle = "#102010";

        [eye1, eye2].forEach(eye => {
            ctx.beginPath();
            ctx.arc(eye.x, eye.y, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

// ========================================
// 6. MOVE THE SNAKE
// ========================================

function moveSnake() {
    direction = { ...nextDirection };

    const head = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };

    // Check for a collision with the wall.
    const hitsWall =
        head.x < 0 ||
        head.y < 0 ||
        head.x >= CELL_COUNT ||
        head.y >= CELL_COUNT;

    if (hitsWall) {
        finishGame(false);
        return;
    }

    const eatingFood =
        head.x === food.x &&
        head.y === food.y;

    // The tail moves away on normal moves.
    const bodyToCheck = eatingFood
        ? snake
        : snake.slice(0, -1);

    // Check for a collision with the snake's body.
    const hitsSelf = bodyToCheck.some(segment =>
        segment.x === head.x &&
        segment.y === head.y
    );

    if (hitsSelf) {
        finishGame(false);
        return;
    }

    snake.unshift(head);

    if (eatingFood) {
        score += POINTS_PER_FOOD;
        scoreDisplay.textContent = String(score);
        placeFood();

        if (gameState !== "playing") {
            return;
        }
    } else {
        snake.pop();
    }

    drawGame();
}

// ========================================
// 7. END THE GAME
// ========================================

function finishGame(won) {
    gameState = "over";
    gameStatus.textContent = won ? "YOU WON!" : "GAME OVER";

    overlay.hidden = false;
    overlayTitle.textContent = won ? "You won!" : "Game over!";
    overlayMessage.textContent = won
        ? "Amazing! You filled the entire board."
        : "Your final score: " + score;

    startButton.textContent = "PLAY AGAIN";

    pendingScore = score;

    if (!won && qualifiesForTopFive(score)) {
        playerFormSection.hidden = false;
        formError.textContent = "";
    } else {
        playerFormSection.hidden = true;
    }
}

// ========================================
// 8. VALIDATE THE PLAYER FORM
// ========================================

playerForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = playerName.value.trim();
    const email = playerEmail.value.trim();

    if (name.length < 3 || name.length > 20) {
        formError.textContent =
            "Your name must be between 3 and 20 characters.";
        playerName.focus();
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    if (!emailPattern.test(email)) {
        formError.textContent =
            "Please enter a valid email address.";
        playerEmail.focus();
        return;
    }

    if (pendingScore === null ||
        !qualifiesForTopFive(pendingScore)) {

        formError.textContent =
            "This score does not qualify for the top five.";
        return;
    }

    highScores.push({
        name: name,
        score: pendingScore
    });

    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5);

    saveScores();
    renderLeaderboard();

    playerFormSection.hidden = true;
    pendingScore = null;
    formError.textContent = "";

    gameStatus.textContent = "SCORE SAVED";
    overlay.hidden = false;
    overlayTitle.textContent = "Score saved!";
    overlayMessage.textContent =
        "Well done, " + name + "! Your score is on the leaderboard.";
    startButton.textContent = "PLAY AGAIN";
});

// ========================================
// 9. DIRECTION CONTROLS
// ========================================

function changeDirection(newDirection) {
    if (gameState !== "playing") {
        return;
    }

    const reversing =
        newDirection.x === -direction.x &&
        newDirection.y === -direction.y;

    if (!reversing) {
        nextDirection = newDirection;
    }
}

const directions = {
    arrowup:    { x: 0, y: -1 },
    w:          { x: 0, y: -1 },
    arrowdown:  { x: 0, y: 1 },
    s:          { x: 0, y: 1 },
    arrowleft:  { x: -1, y: 0 },
    a:          { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d:          { x: 1, y: 0 }
};

document.addEventListener("keydown", function (event) {
    const target = event.target;

    if (
        target instanceof HTMLElement &&
        (
            target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
        )
    ) {
        return;
    }

    const key = event.key.toLowerCase();

    if (directions[key]) {
        event.preventDefault();
        changeDirection(directions[key]);
    }

    if (event.code === "Space") {
        event.preventDefault();
        togglePause();
    }
});

// ========================================
// 10. PAUSE AND RESUME
// ========================================

function togglePause() {
    if (gameState === "playing") {
        gameState = "paused";
        gameStatus.textContent = "PAUSED";

        overlay.hidden = false;
        overlayTitle.textContent = "Game paused";
        overlayMessage.textContent =
            "Take a break, then continue playing.";
        startButton.textContent = "RESUME GAME";
    } else if (gameState === "paused") {
        gameState = "playing";
        gameStatus.textContent = "PLAYING";
        overlay.hidden = true;
    }
}

startButton.addEventListener("click", function () {
    if (gameState === "paused") {
        togglePause();
    } else {
        startGame();
    }
});

// ========================================
// 11. MOBILE TOUCH BUTTONS
// ========================================

document.querySelectorAll("[data-direction]").forEach(button => {
    button.addEventListener("click", function () {
        const directionName = button.dataset.direction;

        if (directionName === "up") {
            changeDirection({ x: 0, y: -1 });
        } else if (directionName === "down") {
            changeDirection({ x: 0, y: 1 });
        } else if (directionName === "left") {
            changeDirection({ x: -1, y: 0 });
        } else if (directionName === "right") {
            changeDirection({ x: 1, y: 0 });
        }
    });
});

// ========================================
// 12. SWIPE CONTROLS FOR TOUCHSCREENS
// ========================================

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "mouse") {
        return;
    }

    touchStartX = event.clientX;
    touchStartY = event.clientY;
});

canvas.addEventListener("pointerup", function (event) {
    if (event.pointerType === "mouse" ||
        gameState !== "playing") {
        return;
    }

    const deltaX = event.clientX - touchStartX;
    const deltaY = event.clientY - touchStartY;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) {
        return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        changeDirection({
            x: deltaX > 0 ? 1 : -1,
            y: 0
        });
    } else {
        changeDirection({
            x: 0,
            y: deltaY > 0 ? 1 : -1
        });
    }
});

// ========================================
// 13. GAME ANIMATION LOOP
// ========================================

function gameLoop(timestamp) {
    if (lastFrameTime === null) {
        lastFrameTime = timestamp;
    }

    const elapsed = Math.min(timestamp - lastFrameTime, 250);
    lastFrameTime = timestamp;

    if (gameState === "playing") {
        timeSinceMove += elapsed;

        if (timeSinceMove >= GAME_SPEED) {
            timeSinceMove %= GAME_SPEED;
            moveSnake();
        }
    }

    requestAnimationFrame(gameLoop);
}

// ========================================
// 14. INITIALISE EVERYTHING
// ========================================

renderLeaderboard();
resetGame();
requestAnimationFrame(gameLoop);