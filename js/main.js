// --- محرك الصوت (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    } else if (type === 'reveal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'win') {
        const now = audioCtx.currentTime;
        [440, 554, 659, 880].forEach((f, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.frequency.setValueAtTime(f, now + i * 0.1);
            g.gain.setValueAtTime(0.1, now + i * 0.1);
            g.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.5);
            o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.5);
        });
    }
}

// --- إدارة البيانات ---
let gameState = {
    currentTurn: 1, // 1 or 2
    teams: {
        1: { name: "", img: "", questions: [], revealed: [], keyword: "" },
        2: { name: "", img: "", questions: [], revealed: [], keyword: "" }
    }
};

// توليد حقول الأسئلة
function generateQuestionInputs(teamNum) {
    const container = document.getElementById(`t${teamNum}-questions-container`);
    const count = document.getElementById(`t${teamNum}-q-count`).value;
    container.innerHTML = "<h3 style='margin-top:15px; color:var(--primary)'>الأسئلة والكلمة السرية:</h3>";
    
    const kwInput = document.createElement('input');
    kwInput.id = `t${teamNum}-keyword`;
    kwInput.placeholder = "الكلمة المفتاحية لتخمين الصورة (مثلاً: أسد)";
    container.appendChild(kwInput);

    const scrollDiv = document.createElement('div');
    scrollDiv.className = 'custom-scrollbar';
    scrollDiv.style.maxHeight = '300px';
    scrollDiv.style.overflowY = 'auto';
    scrollDiv.style.marginTop = '10px';
    scrollDiv.style.paddingRight = '10px';

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'setup-card';
        div.style.background = "rgba(0,0,0,0.3)";
        div.style.padding = "15px";
        div.innerHTML = `
            <p style="font-size:0.9rem; color:var(--secondary); font-weight:bold">سؤال ${i+1}</p>
            <input type="text" class="t${teamNum}-q-text" placeholder="نص السؤال">
            <input type="text" class="t${teamNum}-q-opt" placeholder="الإجابة الصحيحة">
            <input type="text" class="t${teamNum}-q-opt" placeholder="خيار خطأ 1">
            <input type="text" class="t${teamNum}-q-opt" placeholder="خيار خطأ 2">
            <input type="text" class="t${teamNum}-q-opt" placeholder="خيار خطأ 3">
        `;
        scrollDiv.appendChild(div);
    }
    container.appendChild(scrollDiv);
}

// معالجة رفع الصور
function handleImage(event, teamNum) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        gameState.teams[teamNum].img = e.target.result;
    };
    reader.readAsDataURL(file);
}

// بدء اللعبة
function startGame() {
    for (let t = 1; t <= 2; t++) {
        gameState.teams[t].name = document.getElementById(`t${t}-name`).value;
        gameState.teams[t].keyword = document.getElementById(`t${t}-keyword`)?.value || "";
        
        const qTexts = document.querySelectorAll(`.t${t}-q-text`);
        const qOpts = document.querySelectorAll(`.t${t}-q-opt`);
        
        gameState.teams[t].questions = [];
        qTexts.forEach((q, i) => {
            const opts = [];
            for (let j = 0; j < 4; j++) opts.push(qOpts[i * 4 + j].value);
            gameState.teams[t].questions.push({
                text: q.value,
                correct: opts[0],
                options: opts.sort(() => Math.random() - 0.5)
            });
        });

        if (!gameState.teams[t].img) { alert(`يرجى رفع صورة للفريق ${t}`); return; }
        if (gameState.teams[t].questions.length === 0) { alert(`يرجى إضافة أسئلة للفريق ${t}`); return; }
        if (!gameState.teams[t].keyword) { alert(`يرجى إدخال الكلمة المفتاحية للفريق ${t}`); return; }
    }

    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'flex';
    
    initGameUI();
}

// تهيئة واجهة اللعبة
function initGameUI() {
    document.getElementById('display-t1-name').innerText = gameState.teams[1].name;
    document.getElementById('display-t2-name').innerText = gameState.teams[2].name;
    document.getElementById('img-1').src = gameState.teams[1].img;
    document.getElementById('img-2').src = gameState.teams[2].img;

    setupGrid(1);
    setupGrid(2);
    updateTurnUI();
}

function setupGrid(teamNum) {
    const grid = document.getElementById(`grid-${teamNum}`);
    const qCount = gameState.teams[teamNum].questions.length;
    
    let cols = Math.ceil(Math.sqrt(qCount));
    let rows = Math.ceil(qCount / cols);
    
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.innerHTML = "";

    for (let i = 0; i < qCount; i++) {
        const sq = document.createElement('div');
        sq.className = 'square';
        sq.id = `sq-${teamNum}-${i}`;
        sq.innerText = i + 1;
        sq.onclick = () => handleSquareClick(teamNum, i);
        grid.appendChild(sq);
    }
}

function updateTurnUI() {
    // تم إلغاء نظام الأدوار - كلا الفريقين يمكنهما اللعب في أي وقت
    document.getElementById('guess-btn-1').disabled = false;
    document.getElementById('guess-btn-2').disabled = false;
}

function handleSquareClick(teamNum, qIdx) {
    if (gameState.teams[teamNum].revealed.includes(qIdx)) return;

    const question = gameState.teams[teamNum].questions[qIdx];
    showQuestion(question, (isCorrect) => {
        if (isCorrect) {
            revealSquare(teamNum, qIdx);
            playSound('correct');
        } else {
            playSound('wrong');
        }
        // تم إزالة switchTurn()
    });
}

function showQuestion(q, callback) {
    const modal = document.getElementById('question-modal');
    const text = document.getElementById('modal-q-text');
    const optsContainer = document.getElementById('modal-options');
    
    text.innerText = q.text;
    optsContainer.innerHTML = "";
    
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.innerText = opt;
        btn.onclick = () => {
            modal.style.display = 'none';
            callback(opt === q.correct);
        };
        optsContainer.appendChild(btn);
    });
    
    modal.style.display = 'flex';
}

function revealSquare(teamNum, qIdx) {
    const sq = document.getElementById(`sq-${teamNum}-${qIdx}`);
    sq.classList.add('revealed');
    gameState.teams[teamNum].revealed.push(qIdx);
    playSound('reveal');

    if (gameState.teams[teamNum].revealed.length === gameState.teams[teamNum].questions.length) {
        announceWinner(teamNum);
    }
}

function switchTurn() {
    gameState.currentTurn = gameState.currentTurn === 1 ? 2 : 1;
    updateTurnUI();
}

let activeGuessTeam = 0;
function openGuessModal(teamNum) {
    activeGuessTeam = teamNum;
    document.getElementById('guess-modal').style.display = 'flex';
    document.getElementById('guess-input').value = "";
    document.getElementById('guess-input').focus();
}

function submitGuess() {
    const input = document.getElementById('guess-input').value.trim();
    const keyword = gameState.teams[activeGuessTeam].keyword;

    if (input === keyword) {
        const qCount = gameState.teams[activeGuessTeam].questions.length;
        for(let i=0; i<qCount; i++) {
            document.getElementById(`sq-${activeGuessTeam}-${i}`).classList.add('revealed');
        }
        announceWinner(activeGuessTeam);
    } else {
        if (gameState.teams[activeGuessTeam].revealed.length > 0) {
            const lastIdx = gameState.teams[activeGuessTeam].revealed.pop();
            document.getElementById(`sq-${activeGuessTeam}-${lastIdx}`).classList.remove('revealed');
        }
        playSound('wrong');
        closeModals();
        // تم إزالة switchTurn()
    }
}

function announceWinner(teamNum) {
    playSound('win');
    document.getElementById('win-modal').style.display = 'flex';
    document.getElementById('winner-team-name').innerText = gameState.teams[teamNum].name;
}

function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

function exportProject() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameState));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "picture_reveal_project.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importProject(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            gameState = JSON.parse(e.target.result);
            for(let t=1; t<=2; t++) {
                document.getElementById(`t${t}-name`).value = gameState.teams[t].name;
                document.getElementById(`t${t}-q-count`).value = gameState.teams[t].questions.length;
                generateQuestionInputs(t);
                document.getElementById(`t${t}-keyword`).value = gameState.teams[t].keyword;
                
                const qTexts = document.querySelectorAll(`.t${t}-q-text`);
                const qOpts = document.querySelectorAll(`.t${t}-q-opt`);
                gameState.teams[t].questions.forEach((q, i) => {
                    qTexts[i].value = q.text;
                    qOpts[i*4].value = q.correct;
                    qOpts[i*4+1].value = q.options[0];
                    qOpts[i*4+2].value = q.options[1];
                    qOpts[i*4+3].value = q.options[2];
                });
            }
            alert("تم تحميل المشروع بنجاح!");
        } catch(err) {
            alert("خطأ في قراءة ملف المشروع!");
        }
    };
    reader.readAsText(file);
}

function createStars() {
    const container = document.getElementById('stars-container');
    for (let i = 0; i < 150; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const size = Math.random() * 3 + 'px';
        star.style.width = size;
        star.style.height = size;
        star.style.left = Math.random() * 100 + 'vw';
        star.style.top = Math.random() * 100 + 'vh';
        star.style.animationDuration = (Math.random() * 50 + 50) + 's';
        container.appendChild(star);
    }
}

window.onload = () => {
    createStars();
    generateQuestionInputs(1);
    generateQuestionInputs(2);
};
