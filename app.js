(function () {
    "use strict";

    // --- State ---
    let config = null;
    let subjectColors = {};
    let questions = [];
    let currentIndex = 0;
    let selected = {};       // questionId -> optionIndex
    let submitted = false;
    let showExplanation = {}; // questionId -> bool
    let startTime = Date.now();
    let timerInterval = null;

    const app = document.getElementById("app");

    // --- Bootstrap ---
    Promise.all([
        fetch("config.json").then(r => r.json()),
        fetch("questions.json").then(r => r.json())
    ]).then(([cfg, data]) => {
        config = cfg;
        subjectColors = data.subjectColors;

        // Filter to selected subjects
        let pool = data.questions.filter(q => config.subjects.includes(q.subject));

        // Pick questionsPerSubject per subject (0 = all)
        if (config.questionsPerSubject > 0) {
            const bySubject = {};
            pool.forEach(q => {
                (bySubject[q.subject] = bySubject[q.subject] || []).push(q);
            });
            pool = [];
            config.subjects.forEach(subj => {
                const bucket = bySubject[subj] || [];
                shuffle(bucket);
                pool.push(...bucket.slice(0, config.questionsPerSubject));
            });
        }

        shuffle(pool);
        questions = pool;
        startTime = Date.now();
        startTimer();
        render();
    }).catch(err => {
        app.innerHTML = `<p style="color:red;padding:40px;text-align:center;">Failed to load exam data: ${err.message}</p>`;
    });

    // --- Helpers ---
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            if (submitted) return;
            const elapsed = Date.now() - startTime;
            if (config.timeLimitMinutes > 0) {
                const remaining = config.timeLimitMinutes * 60000 - elapsed;
                if (remaining <= 0) {
                    clearInterval(timerInterval);
                    submitted = true;
                    render();
                    return;
                }
            }
            // Update just the timer text without full re-render
            const timerEl = document.getElementById("timer-display");
            if (timerEl) timerEl.textContent = formatTime();
        }, 1000);
    }

    function formatTime() {
        const elapsed = Date.now() - startTime;
        if (config.timeLimitMinutes > 0) {
            const remaining = Math.max(0, config.timeLimitMinutes * 60000 - elapsed);
            const m = Math.floor(remaining / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            return m + ":" + String(s).padStart(2, "0");
        }
        const m = Math.floor(elapsed / 60000);
        const s = Math.floor((elapsed % 60000) / 1000);
        return m + ":" + String(s).padStart(2, "0");
    }

    function escHtml(str) {
        const d = document.createElement("div");
        d.textContent = str;
        return d.innerHTML;
    }

    // --- Scoring ---
    function getScore() {
        return questions.reduce((s, q) => s + (selected[q.id] === q.answer ? 1 : 0), 0);
    }

    // --- Render ---
    function render() {
        if (!questions.length) return;

        const q = questions[currentIndex];
        const sc = subjectColors[q.subject] || { bg: "#f3f3f3", accent: "#666", icon: "?" };
        const answered = Object.keys(selected).length;
        const totalQ = questions.length;
        const uniqueSubjects = [...new Set(questions.map(q => q.subject))];
        const score = submitted ? getScore() : 0;
        const pct = Math.round((score / totalQ) * 100);
        const navCols = Math.min(totalQ, 20);

        let html = "";

        // Header
        html += `
        <div style="text-align:center;padding:28px 0 18px;border-bottom:3px solid #1a1a2e">
            <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#666;margin-bottom:4px;font-weight:700">${escHtml(config.subtitle)}</div>
            <h1 style="font-family:'Source Serif 4',Georgia,serif;font-size:30px;font-weight:700;margin:0 0 6px;letter-spacing:-0.5px;line-height:1.1">${escHtml(config.title)}</h1>
            <div style="font-size:13px;color:#777;display:flex;justify-content:center;gap:20px">
                <span>${totalQ} Questions</span>
                <span>&bull;</span>
                <span>${uniqueSubjects.length} Subjects</span>
                <span>&bull;</span>
                <span id="timer-display" style="font-variant-numeric:tabular-nums">${formatTime()}</span>
            </div>
        </div>`;

        // Subject legend
        html += `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:16px 0">`;
        uniqueSubjects.forEach(name => {
            const c = subjectColors[name] || { bg: "#f3f3f3", accent: "#666", icon: "?" };
            html += `<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${c.bg};color:${c.accent};border:1.5px solid ${c.accent}30;letter-spacing:0.3px">${c.icon} ${escHtml(name)}</span>`;
        });
        html += `</div>`;

        // Nav grid
        html += `<div style="display:grid;grid-template-columns:repeat(${navCols},1fr);gap:4px;margin:10px 0 22px">`;
        questions.forEach((qq, i) => {
            const c = subjectColors[qq.subject] || { bg: "#f3f3f3", accent: "#666" };
            const isAnswered = selected[qq.id] !== undefined;
            const isCurrent = i === currentIndex;
            const isCorrect = submitted && selected[qq.id] === qq.answer;
            const isWrong = submitted && isAnswered && selected[qq.id] !== qq.answer;
            const isMissed = submitted && !isAnswered;

            let bg, color, border;
            if (submitted) {
                bg = isCorrect ? "#d1fae5" : (isWrong || isMissed) ? "#fee2e2" : "#f3f3f3";
                color = isCorrect ? "#065f46" : "#991b1b";
            } else {
                bg = isAnswered ? c.bg : "#fff";
                color = isAnswered ? c.accent : "#999";
            }
            border = isCurrent ? `2.5px solid ${c.accent}` : "1.5px solid #ccc";

            html += `<button data-nav="${i}" style="width:100%;aspect-ratio:1;border-radius:4px;border:${border};background:${bg};cursor:pointer;font-size:10px;font-weight:700;color:${color};padding:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s">${i + 1}</button>`;
        });
        html += `</div>`;

        // Score banner
        if (submitted) {
            const passBg = pct >= config.passingPercent
                ? "linear-gradient(135deg,#065f46,#10b981)"
                : "linear-gradient(135deg,#991b1b,#ef4444)";
            const passMsg = pct >= config.passingPercent
                ? "Passing score! Great job!"
                : "Keep studying \u2014 you'll get there!";
            html += `
            <div style="background:${passBg};color:#fff;border-radius:12px;padding:20px 24px;margin-bottom:20px;text-align:center">
                <div style="font-size:42px;font-weight:800;line-height:1">${score}/${totalQ}</div>
                <div style="font-size:14px;margin-top:4px;opacity:0.9">${pct}% \u2014 ${passMsg}</div>
                <div style="font-size:12px;margin-top:6px;opacity:0.7">The GED passing score is roughly 145/200 per subject. This practice test gives you a general idea of the topics covered.</div>
            </div>`;
        }

        // Question card
        html += `
        <div style="background:#fff;border-radius:14px;border:2px solid ${sc.accent}25;box-shadow:0 2px 12px rgba(0,0,0,0.06);overflow:hidden">
            <div style="background:${sc.bg};padding:12px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${sc.accent}20">
                <span style="font-size:12px;font-weight:700;color:${sc.accent}">${sc.icon} ${escHtml(q.subject)} \u2014 ${escHtml(q.topic)}</span>
                <span style="font-size:12px;font-weight:700;color:#888">Q${currentIndex + 1} of ${totalQ}</span>
            </div>
            <div style="padding:22px 22px 18px">
                <p style="font-size:17px;line-height:1.55;font-weight:600;margin:0 0 18px">${escHtml(q.question)}</p>
                <div style="display:flex;flex-direction:column;gap:10px">`;

        q.options.forEach((opt, oi) => {
            const isSelected = selected[q.id] === oi;
            const isCorrectAnswer = oi === q.answer;
            const showRight = submitted && isCorrectAnswer;
            const showWrong = submitted && isSelected && !isCorrectAnswer;

            let border, bg, circleBg, circleColor, circleText;
            if (showRight) {
                border = "2px solid #059669"; bg = "#ecfdf5";
                circleBg = "#059669"; circleColor = "#fff"; circleText = "\u2713";
            } else if (showWrong) {
                border = "2px solid #dc2626"; bg = "#fef2f2";
                circleBg = "#dc2626"; circleColor = "#fff"; circleText = "\u2717";
            } else if (isSelected) {
                border = `2px solid ${sc.accent}`; bg = sc.bg;
                circleBg = sc.accent; circleColor = "#fff"; circleText = String.fromCharCode(65 + oi);
            } else {
                border = "2px solid #e5e5e5"; bg = "#fafafa";
                circleBg = "#e5e5e5"; circleColor = "#888"; circleText = String.fromCharCode(65 + oi);
            }

            html += `
                <button data-option="${oi}" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;border:${border};background:${bg};cursor:${submitted ? "default" : "pointer"};text-align:left;font-size:15px;line-height:1.4;font-family:inherit;color:#1a1a2e;transition:all 0.15s">
                    <span style="width:28px;height:28px;min-width:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;background:${circleBg};color:${circleColor}">${circleText}</span>
                    <span>${escHtml(opt)}</span>
                </button>`;
        });

        html += `</div>`;

        // Explanation toggle
        if (submitted) {
            const expVisible = showExplanation[q.id];
            html += `
                <div style="margin-top:14px">
                    <button data-explain="${q.id}" style="background:none;border:none;cursor:pointer;color:${sc.accent};font-weight:700;font-size:13px;font-family:inherit;padding:4px 0">
                        ${expVisible ? "Hide Explanation \u25B2" : "Show Explanation \u25BC"}
                    </button>`;
            if (expVisible) {
                html += `
                    <div style="margin-top:8px;padding:12px 16px;background:${sc.bg};border-radius:8px;font-size:14px;line-height:1.6;border-left:4px solid ${sc.accent}">${escHtml(q.explanation)}</div>`;
            }
            html += `</div>`;
        }

        html += `</div></div>`;

        // Navigation buttons
        const prevDisabled = currentIndex === 0;
        const nextDisabled = currentIndex === totalQ - 1;

        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:18px;gap:12px">
            <button data-prev style="padding:10px 20px;border-radius:8px;border:2px solid #ddd;background:#fff;font-weight:700;font-size:14px;cursor:${prevDisabled ? "default" : "pointer"};opacity:${prevDisabled ? 0.4 : 1};font-family:inherit" ${prevDisabled ? "disabled" : ""}>\u2190 Prev</button>`;

        if (!submitted) {
            const submitBg = answered === totalQ ? "#1a1a2e" : "#888";
            const submitShadow = answered === totalQ ? "0 2px 8px rgba(0,0,0,0.2)" : "none";
            html += `
            <button data-submit style="padding:10px 24px;border-radius:8px;border:none;background:${submitBg};color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:${submitShadow}">Submit Exam (${answered}/${totalQ})</button>`;
        }

        html += `
            <button data-next style="padding:10px 20px;border-radius:8px;border:2px solid #ddd;background:#fff;font-weight:700;font-size:14px;cursor:${nextDisabled ? "default" : "pointer"};opacity:${nextDisabled ? 0.4 : 1};font-family:inherit" ${nextDisabled ? "disabled" : ""}>Next \u2192</button>
        </div>`;

        // Disclaimer
        html += `<p style="text-align:center;font-size:11px;color:#999;margin-top:24px;line-height:1.5">This is an unofficial practice test for study purposes only. The actual GED\u00ae test is administered by GED Testing Service LLC.</p>`;

        app.innerHTML = html;
    }

    // --- Event delegation ---
    app.addEventListener("click", function (e) {
        const btn = e.target.closest("button");
        if (!btn) return;

        if (btn.dataset.nav !== undefined) {
            currentIndex = parseInt(btn.dataset.nav, 10);
            render();
        } else if (btn.dataset.option !== undefined && !submitted) {
            const q = questions[currentIndex];
            selected[q.id] = parseInt(btn.dataset.option, 10);
            render();
        } else if (btn.dataset.prev !== undefined) {
            if (currentIndex > 0) { currentIndex--; render(); }
        } else if (btn.dataset.next !== undefined) {
            if (currentIndex < questions.length - 1) { currentIndex++; render(); }
        } else if (btn.dataset.submit !== undefined) {
            const answered = Object.keys(selected).length;
            if (answered < questions.length) {
                if (!confirm(`You've answered ${answered} of ${questions.length} questions. Unanswered questions will be marked wrong. Submit anyway?`)) return;
            }
            submitted = true;
            clearInterval(timerInterval);
            render();
        } else if (btn.dataset.explain !== undefined) {
            const id = parseInt(btn.dataset.explain, 10);
            showExplanation[id] = !showExplanation[id];
            render();
        }
    });
})();
