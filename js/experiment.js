// Su, Qiu & Ding (2025) Experiment 1a, online replication. Version v1.5.
// Modes (URL parameters):
//   (none)                    the real study
//   ?simulate=data-only&sessions=N   N simulated sessions, no saving (developer check)
//   ?timingcheck=1            20 auto-answered trials, then a timing summary (check on your own laptop)
"use strict";

const URLP = new URLSearchParams(window.location.search);
const MODE = URLP.get("timingcheck") ? "timingcheck" : URLP.get("simulate") ? "simulate" : "live";

// ------------------------------------------------------------------ helpers
function getSonaId() {
  for (const k of CONFIG.sona_id_params) { const v = URLP.get(k); if (v) return v; }
  return "";
}
function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
function exitFullscreen() {
  if (document.exitFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (document.webkitExitFullscreen && document.webkitFullscreenElement) document.webkitExitFullscreen();
}
// Laptops and desktops only: a phone or tablet has no F/J keys (D08).
function isPhoneOrTablet() {
  const ua = navigator.userAgent;
  const iPadAsMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const noFinePointer = window.matchMedia && !window.matchMedia("(any-pointer: fine)").matches;
  return /Mobi|Android|iPhone|iPad/i.test(ua) || iPadAsMac || noFinePointer;
}
function median(a) { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(rows, cols) {
  return [cols.join(",")].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))).join("\n");
}
// Measure the refresh interval from requestAnimationFrame timestamps (D07).
function measureRefresh(nFrames) {
  return new Promise((resolve) => {
    const ts = [];
    const tick = (t) => { ts.push(t); if (ts.length <= nFrames) requestAnimationFrame(tick); else {
      // Browsers round rAF timestamps, so use the mean of the typical intervals (within 0.5 to 1.5
      // times the median), not the median itself.
      const d = ts.slice(1).map((t, i) => t - ts[i]);
      const med = median(d);
      const keep = d.filter((x) => x > 0.5 * med && x < 1.5 * med);
      const mean = keep.reduce((s, x) => s + x, 0) / keep.length;
      resolve({ frame_ms: mean, refresh_hz: 1000 / mean, frame_sd_ms: Math.sqrt(keep.reduce((s, x) => s + (x - mean) ** 2, 0) / keep.length),
        frames_sampled: d.length, frames_irregular: d.length - keep.length });
    } };
    requestAnimationFrame(tick);
  });
}

// ------------------------------------------------------------------ session state
const SESSION = {
  version: CONFIG.version, mode: MODE, sona_id: getSonaId(), subject_id: null,
  start_time: new Date().toISOString(), end_time: null,
  screen_width: window.screen.width, screen_height: window.screen.height,
  device_pixel_ratio: window.devicePixelRatio, user_agent: navigator.userAgent,
  fullscreen_exits: 0, task_started: false, completed: false, n_checkins_no_response: 0, n_checkins_rushed: 0, quiz_attempts: 0,
  practice_attempts: 0, practice_passed: 0,
  frame_ms: 1000 / 60, refresh_hz: null, frame_sd_ms: null, vsync_rate_browsercheck: null,
  save_ok: null, scene_scale: null, response_scale: null,
};
const SIZES = {};   // pixel sizes used on screen, set once the page is in full screen
// True from the end of the instructions until the save step has finished; while true, leaving the
// page asks the person to confirm, because leaving then loses the data.
let LEAVE_WARNING = false;
// The files built at the save step, kept so a participant can download them if saving fails.
let SAVED_OUT = null;
// Download the trial file in the same format and under the same name as the DataPipe copy, so it
// can go straight into the analysis folder.
function downloadTrials() {
  if (!SAVED_OUT) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([SAVED_OUT.trials_csv], { type: "text/csv" }));
  a.download = `exp1a_${CONFIG.version}_${SESSION.subject_id}_trials.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}

// Image sizes (D05). No calibration: each image is shown at its file size in CSS pixels, shrunk to fit
// the window (CONFIG.fit_margin of its width and height) if it is larger. The scene and the two-option
// screen are fitted separately; the catch answer screens use the same frame as the two options.
function applySizes() {
  const W = window.innerWidth * CONFIG.fit_margin, H = window.innerHeight * CONFIG.fit_margin;
  const sceneScale = Math.min(1, W / CONFIG.scene_px, H / CONFIG.scene_px);
  const respScale = Math.min(1, W / (2 * CONFIG.option_w_px), H / CONFIG.option_h_px);
  Object.assign(SESSION, { scene_scale: sceneScale, response_scale: respScale, window_width: window.innerWidth, window_height: window.innerHeight });
  Object.assign(SIZES, {
    scene_px: CONFIG.scene_px * sceneScale,
    option_w_px: CONFIG.option_w_px * respScale, option_h_px: CONFIG.option_h_px * respScale,
    fixation_px: CONFIG.fixation_px, fixation_line_px: CONFIG.fixation_line_px,          // S28 (D05)
    text_px: CONFIG.catch_text_frac * 2 * CONFIG.option_w_px * respScale,               // S69 (D10)
  });
}

// ------------------------------------------------------------------ trial list (D13)
// The main stimuli shown: Table S1 rows 1-90 minus CONFIG.removed_from_task (v1.5: stimulus 72, the demo example; D27).
const TASK_STIMULI = MAIN_STIMULI.filter((m) => !CONFIG.removed_from_task.includes(m.stim_id));
function buildTrialList(jsPsych) {
  const R = jsPsych.randomization;
  const n = TASK_STIMULI.length;                                       // 89 (S73: 90; D27)
  const main = R.shuffle(TASK_STIMULI.slice());                        // S77: random order per person (D13)
  // S78: target on the left in half the main trials (D13). With an odd number, 44 or 45 on the left, chosen at random.
  const nLeft = n % 2 === 0 ? n / 2 : Math.random() < 0.5 ? Math.floor(n / 2) : Math.ceil(n / 2);
  const sides = R.shuffle(Array(nLeft).fill("left").concat(Array(n - nLeft).fill("right")));
  const catches = R.shuffle(CATCH_STIMULI.slice());
  // One catch trial at a random spot in each sixth of the main trials (S68, S70; D11). With 89 main trials the sixths
  // hold 15, 15, 15, 14, 15 and 15 (boundaries rounded from 89 x b / 6).
  const cut = Array.from({ length: CONFIG.n_catch + 1 }, (_, b) => Math.round((b * n) / CONFIG.n_catch));
  const list = [];
  for (let b = 0; b < CONFIG.n_catch; b++) {
    const block = main.slice(cut[b], cut[b + 1]).map((m, i) => ({ kind: "main", stim: m, side: sides[cut[b] + i] }));
    const pos = Math.floor(Math.random() * (block.length + 1));
    block.splice(pos, 0, { kind: "catch", stim: catches[b] });
    list.push(...block);
  }
  return list;
}

// Simulated accuracy: U shape read from Figure 2E (logit = 1.18 - 2.04x + 3.12x^2), plus a
// participant offset (SD 0.42). Used only in simulation mode.
let SIM_OFFSET = 0;
function simPCorrect(item) {
  if (item.kind === "catch") return 0.97;
  const x = item.stim.congruency;
  return 1 / (1 + Math.exp(-(1.18 - 2.04 * x + 3.12 * x * x + SIM_OFFSET)));
}

function makeTrial(jsPsych, item, index) {
  const isMain = item.kind === "main";
  const s = item.stim;
  const fix1 = CONFIG.fixation1_min_ms + Math.random() * (CONFIG.fixation1_max_ms - CONFIG.fixation1_min_ms);   // S57 uniform
  const left = isMain ? (item.side === "left" ? s.target : s.lure) : null;
  const right = isMain ? (item.side === "left" ? s.lure : s.target) : null;
  const correct = isMain ? (item.side === "left" ? CONFIG.key_left : CONFIG.key_right) : s.correct;   // S62, S72
  return {
    type: jsPsychScene2AFC,
    trial_kind: item.kind,
    scene: s.scene,
    left_image: left, right_image: right,
    question_html: "What was the scene you just saw?",                // S69, English text (D10)
    left_text: isMain ? "" : s.option_f, right_text: isMain ? "" : s.option_j,
    correct_key: correct, key_left: CONFIG.key_left, key_right: CONFIG.key_right,
    fixation1_ms: fix1, scene_ms: CONFIG.scene_ms, fixation2_ms: CONFIG.fixation2_ms,       // S57-S59
    response_limit_ms: CONFIG.response_limit_ms,                                           // S63
    frame_ms: () => SESSION.frame_ms,
    scene_px: () => SIZES.scene_px, option_w_px: () => SIZES.option_w_px, option_h_px: () => SIZES.option_h_px,
    fixation_px: () => SIZES.fixation_px, fixation_line_px: () => SIZES.fixation_line_px, text_px: () => SIZES.text_px,
    background: CONFIG.background,                                                          // S27
    sim_p_correct: simPCorrect(item),
    on_finish: (d) => updateCheckIn(d),
    data: {
      phase: "task", trial_number: index + 1, stim_id: s.stim_id,
      scene_label: s.scene_label, object_label: isMain ? s.object_label : "",
      congruency: isMain ? s.congruency : "", analyzed_stimulus: isMain ? s.analyzed : "",
      scene_file: s.scene, target_file: isMain ? s.target : "", foil_file: isMain ? s.lure : "",
      target_side: isMain ? item.side : (s.correct === CONFIG.key_left ? "left" : "right"),
      left_file: left || "", right_file: right || "",
      left_text: isMain ? "" : s.option_f, right_text: isMain ? "" : s.option_j,
    },
  };
}

// ------------------------------------------------------------------ check-ins (your additions P8 and P9; D23, D24)
// Not part of the original task. After each trial, the task may pause with a message:
//   P8: no F or J answer in CONFIG.checkin_after_misses trials in a row -> "Are you still there?"
//   P9: CONFIG.rush_trials of the last CONFIG.rush_window trials were rushed -> "Please slow down a little"
// A trial is rushed if F or J was pressed CONFIG.rush_early_presses or more times before the two options
// appeared, or if the answer came faster than CONFIG.rush_fast_rt_ms. Each counter restarts after its check-in.
const CHECKIN = { misses: 0, recent: [], pending: null };
function updateCheckIn(d) {
  CHECKIN.misses = d.timed_out === 1 ? CHECKIN.misses + 1 : 0;
  const rushed = d.early_presses >= CONFIG.rush_early_presses || (d.rt_ms !== null && d.rt_ms < CONFIG.rush_fast_rt_ms);
  d.rushed = rushed ? 1 : 0;
  d.checkin_after = "";
  CHECKIN.recent.push(d.rushed);
  if (CHECKIN.recent.length > CONFIG.rush_window) CHECKIN.recent.shift();
}
function checkInNode(jsPsych) {
  const msg = {
    no_response: `<div class="textpage"><h2>Are you still there?</h2>
      <p>We did not get an answer in the last ${CONFIG.checkin_after_misses} trials.</p>
      <p>When the two objects appear, press <b>F</b> if the object from the photo is on the left, or <b>J</b> if it is on the right. You have about 2.5 seconds to answer.</p>
      <p>Click Continue when you are ready.</p></div>`,
    rushed: `<div class="textpage"><h2>Please slow down a little</h2>
      <p>It looks like F or J was pressed before the two objects appeared, or very quickly after they appeared.</p>
      <p>Wait until the two objects appear. Then press <b>F</b> if the object from the photo is on the left, or <b>J</b> if it is on the right. Answer as quickly and accurately as you can.</p>
      <p>Click Continue when you are ready.</p></div>`,
  };
  return {
    timeline: [{
      type: jsPsychHtmlButtonResponse, choices: ["Continue"], data: { phase: "checkin" },
      stimulus: () => pageHTML("Quick check-in", msg[CHECKIN.pending].replace(/^<div class="textpage">|<\/div>$/g, ""), "", false),
      on_finish: (d) => {
        d.checkin_type = CHECKIN.pending;
        const last = jsPsych.data.get().filter({ phase: "task" }).last(1).values()[0];
        if (last) last.checkin_after = CHECKIN.pending;          // marks the trial after which it appeared
        if (CHECKIN.pending === "no_response") { SESSION.n_checkins_no_response += 1; CHECKIN.misses = 0; }
        else { SESSION.n_checkins_rushed += 1; CHECKIN.recent = []; }
        CHECKIN.pending = null;
      },
    }],
    conditional_function: () => {
      if (CHECKIN.misses >= CONFIG.checkin_after_misses) { CHECKIN.pending = "no_response"; return true; }
      if (CHECKIN.recent.reduce((a, b) => a + b, 0) >= CONFIG.rush_trials) { CHECKIN.pending = "rushed"; return true; }
      return false;
    },
  };
}

// ------------------------------------------------------------------ screens modeled on the lab template (v1.4; D09)
// A header bar across the top and a grey box in the middle. `fill` makes the page fill the window and centre the
// box (used when the buttons are inside the box); without it, a plugin's own buttons follow the box.
function pageHTML(header, inner, boxClass = "", fill = true) {
  return `<div class="pg-header">${header}</div><div class="pg-wrap"${fill ? "" : ' style="min-height:0"'}><div class="pg-box ${boxClass}">${inner}</div></div>`;
}
// A screen we draw ourselves inside a call-function trial. render(el, done) draws it and calls done(data) when the
// person moves on. Simulated sessions skip it (simData gives the data they record instead).
function customScreen(jsPsych, phase, render, simData = () => ({})) {
  return {
    type: jsPsychCallFunction, async: true, data: { phase },
    func: (done) => {
      if (MODE !== "live") { done({ simulated: true, ...simData() }); return; }
      const el = jsPsych.getDisplayElement();
      window.scrollTo(0, 0);
      render(el, (data) => { el.innerHTML = ""; done(data); });
    },
  };
}
// Several pages with Previous / "2 / 5" / Next buttons inside the box; the last page's button says lastLabel.
// Records how long each page was on screen (page_ms, in order of viewing).
function pagedScreen(jsPsych, phase, getHeader, getPages, lastLabel) {
  return customScreen(jsPsych, phase, (el, done) => {
    const pages = getPages(), header = getHeader();
    let i = 0, t = performance.now();
    const views = [];
    const draw = () => {
      const pg = pages[i];
      const body = pg.pic
        ? `<div class="pg-cols"><div class="pg-text">${pg.text}</div><div class="pg-pic">${pg.pic}</div></div>`
        : pg.text;
      el.innerHTML = pageHTML(header, `<h2>${pg.title}</h2>${body}
        <div class="pg-nav"><button class="pg-btn" id="pg-prev" ${i === 0 ? "disabled" : ""}>&larr; Previous</button>
        <span class="pg-count">${i + 1} / ${pages.length}</span>
        <button class="pg-btn" id="pg-next">${i === pages.length - 1 ? lastLabel : "Next &rarr;"}</button></div>`, "wide");
      el.querySelector("#pg-prev").onclick = () => { step(-1); };
      el.querySelector("#pg-next").onclick = () => { step(+1); };
    };
    const step = (d) => {
      const now = performance.now(); views.push({ page: i + 1, ms: Math.round(now - t) }); t = now;
      if (i + d >= pages.length) { done({ page_views: views, n_pages: pages.length }); return; }
      i = Math.max(0, i + d); window.scrollTo(0, 0); draw();
    };
    draw();
  });
}

// Instruction pages (D09; the original's instructions are not published, S82). v1.5: the example uses real pictures
// (your request, 6 Nov 2026): scene 72 with a red circle around the egg carton, its target and its lure. Stimulus 72 is
// not in the task (D27), so nothing the person sees here comes up again.
const sk = {
  frame: (inner, cls = "") => `<span class="sk-frame ${cls}"><span class="sk-mid">${inner}</span></span>`,
};
function instructionPages() {
  const D = CONFIG.demo;
  const plus = '<span class="dm-box dm-plus">+</span>';
  return [
    { title: "The task",
      text: `<p>In this study, you will see photos of everyday places, such as kitchens and bathrooms.</p>
             <p>After each photo, you will see two objects of the same kind, such as two egg cartons. Only one of them is the exact object that was in the photo. Your job is to pick that one.</p>`,
      pic: `<img class="dm-scene" src="${D.scene_circled}" alt="Example photo of a kitchen"><div class="dm-cap">Example photo. The red circle is only in this example.</div>` },
    { title: "Each trial",
      text: `<ol><li>A small <b>+</b> appears in the middle of the screen. Look at it.</li>
               <li>A photo appears for 2.5 seconds. You can look anywhere in the photo.</li>
               <li>The <b>+</b> appears again.</li>
               <li>Two objects appear side by side.</li></ol>`,
      pic: `<div class="dm-seq">${plus}<span class="sk-arrow">&darr;</span>
             <img class="dm-thumb" src="${D.scene_circled}" alt=""><span class="sk-arrow">&darr;</span>
             ${plus}<span class="sk-arrow">&darr;</span>
             <span class="dm-pair"><img src="${D.target}" alt=""><img src="${D.lure}" alt=""></span></div>` },
    { title: "How to answer",
      text: `<p>Press <b>F</b> if the object from the photo is on the <b>left</b>.</p>
             <p>Press <b>J</b> if it is on the <b>right</b>.</p>
             <p>In this example, the egg carton from the photo is on the left, so the answer is <b>F</b>.</p>
             <p>Wait until the two objects appear before you press a key. Answer as quickly and accurately as you can. If you take too long, the study moves on to the next trial.</p>`,
      pic: `<div class="dm-answer"><span><img src="${D.target}" alt="The egg carton from the photo"><span class="sk-key">F</span></span>
            <span><img src="${D.lure}" alt="A different egg carton"><span class="sk-key">J</span></span></div>` },
    { title: "A few different questions",
      text: `<p>A few times, you will get a different question about the photo, such as which kind of room it showed.</p>
             <p>Answer it with the same keys: <b>F</b> for the answer on the left, <b>J</b> for the answer on the right.</p>`,
      pic: `<div style="font-weight:700;font-size:17px;margin:6px 0 14px">What was the scene you just saw?</div>
            <div style="display:flex;justify-content:space-around;font-weight:700;font-size:17px"><span>f. Office</span><span>j. Garage</span></div>
            <div style="margin-top:10px;color:#777">(example)</div>` },
    { title: "Practice trial",
      text: `<p>Next, you will do one practice trial with the same kitchen photo.</p>
             <p>In the real trials there is no red circle, and the photos and objects are different.</p>
             <p>Put your fingers on <b>F</b> and <b>J</b>, then click <b>Start practice</b>.</p>` },
  ];
}

// Practice trial (your addition P11, 6 Nov 2026; D26; S75: none in the original). The circled kitchen photo, then the
// two egg cartons with the one from the photo on the right (answer J; the instructions showed it on the left), with the
// task's own timing and 2.5-second limit. Feedback follows. It repeats until answered correctly, at most
// CONFIG.practice_max_tries times per pass through the instructions. Logged as phase "practice"; not in the trial file.
const PRACTICE = { attempts: 0, passed: false, triesThisPass: 0, passedThisPass: false };
function lastPractice(jsPsych) { return jsPsych.data.get().filter({ phase: "practice" }).last(1).values()[0] || {}; }
function practiceNode(jsPsych) {
  const D = CONFIG.demo;
  const trial = {
    type: jsPsychScene2AFC, trial_kind: "main", scene: D.scene_circled, left_image: D.lure, right_image: D.target,
    correct_key: CONFIG.key_right, key_left: CONFIG.key_left, key_right: CONFIG.key_right,
    fixation1_ms: () => CONFIG.fixation1_min_ms + Math.random() * (CONFIG.fixation1_max_ms - CONFIG.fixation1_min_ms),
    scene_ms: CONFIG.scene_ms, fixation2_ms: CONFIG.fixation2_ms, response_limit_ms: CONFIG.response_limit_ms,
    frame_ms: () => SESSION.frame_ms,
    scene_px: () => SIZES.scene_px, option_w_px: () => SIZES.option_w_px, option_h_px: () => SIZES.option_h_px,
    fixation_px: () => SIZES.fixation_px, fixation_line_px: () => SIZES.fixation_line_px, text_px: () => SIZES.text_px,
    background: CONFIG.background, sim_p_correct: 1,
    data: { phase: "practice", stim_id: 72, target_side: "right", left_file: D.lure, right_file: D.target, scene_file: D.scene_circled },
    on_finish: (d) => {
      PRACTICE.attempts += 1; PRACTICE.triesThisPass += 1; d.practice_attempt = PRACTICE.attempts;
      if (d.accuracy === 1) { PRACTICE.passed = true; PRACTICE.passedThisPass = true; }
      SESSION.practice_attempts = PRACTICE.attempts; SESSION.practice_passed = PRACTICE.passed ? 1 : 0;
    },
  };
  const feedback = {
    type: jsPsychHtmlButtonResponse, data: { phase: "practice_feedback" },
    choices: () => [PRACTICE.passedThisPass || PRACTICE.triesThisPass >= CONFIG.practice_max_tries ? "Continue" : "Try again"],
    stimulus: () => {
      const d = lastPractice(jsPsych);
      let title, text;
      if (d.accuracy === 1) { title = "Correct!"; text = "The egg carton from the photo was on the right, so <b>J</b> was the correct answer."; }
      else if (d.timed_out === 1) { title = "Too slow"; text = "Please answer within 2.5 seconds after the two objects appear. The egg carton from the photo was on the right, so the answer was <b>J</b>."; }
      else { title = "Not quite"; text = "The egg carton from the photo was on the <b>right</b>, so the answer was <b>J</b>."; }
      const next = d.accuracy === 1 ? "<p>Next, a few quick questions about the instructions.</p>"
        : PRACTICE.triesThisPass < CONFIG.practice_max_tries ? "<p>Let's try it again.</p>"
          : "<p>Next, a few quick questions about the instructions.</p>";
      return pageHTML("Practice trial", `<h2>${title}</h2><p>${text}</p>${next}`, "", false);
    },
  };
  return [
    { type: jsPsychCallFunction, data: { phase: "practice_start" }, func: () => { PRACTICE.triesThisPass = 0; PRACTICE.passedThisPass = false; return {}; } },
    { timeline: [fullscreenWait(), trial, feedback],
      loop_function: () => !PRACTICE.passedThisPass && PRACTICE.triesThisPass < CONFIG.practice_max_tries },
  ];
}

// Comprehension check (your addition P10; D25). All answers must be right to start; otherwise the person
// reads the instructions again and answers again. Every attempt is logged; nobody is excluded for it.
const QUIZ = { attempts: 0, passed: false };
const QUIZ_QUESTIONS = [
  { q: "When the two objects appear, which one do you choose?", name: "which",
    options: ["The one that fits the room best", "The one that was in the photo", "The larger one", "The one I like better"], correct: 1 },
  { q: "The object from the photo is on the left. Which key do you press?", name: "key",
    options: ["J", "The space bar", "F", "I click on it"], correct: 2 },
  { q: "When should you press F or J?", name: "when",
    options: ["As soon as the photo appears", "Whenever I want", "Only in the last trial", "After the two objects appear"], correct: 3 },
];
function quizScreen(jsPsych) {
  return customScreen(jsPsych, "quiz", (el, done) => {
    const t0 = performance.now();
    el.innerHTML = pageHTML("Quick check!", `<h2>Attention Check</h2>
      <p>Please answer these questions. You need to answer all of them correctly to start the task.</p>
      <div class="pg-quiz">${QUIZ_QUESTIONS.map((x, qi) => `<div class="q">${qi + 1}. ${x.q}</div>
        ${x.options.map((o, oi) => `<label><input type="radio" name="${x.name}" value="${oi}">${o}</label>`).join("")}`).join("")}</div>
      <p id="pg-quiz-note" style="color:#a00;text-align:center;min-height:1.6em;margin:10px 0 0"></p>
      <div class="pg-nav" style="margin-top:4px"><button class="pg-btn" id="pg-check">Check my answers</button></div>`, "wide");
    el.querySelector("#pg-check").onclick = () => {
      const ans = QUIZ_QUESTIONS.map((x) => { const c = el.querySelector(`input[name=${x.name}]:checked`); return c ? +c.value : null; });
      if (ans.some((a) => a === null)) { el.querySelector("#pg-quiz-note").textContent = "Please answer every question."; return; }
      const correct = ans.map((a, k) => (a === QUIZ_QUESTIONS[k].correct ? 1 : 0));
      QUIZ.attempts += 1; QUIZ.passed = correct.every(Boolean);
      SESSION.quiz_attempts = QUIZ.attempts;
      done({ attempt: QUIZ.attempts, answers: ans, correct, passed: QUIZ.passed ? 1 : 0, rt: Math.round(performance.now() - t0) });
    };
  }, () => { QUIZ.attempts += 1; QUIZ.passed = true; SESSION.quiz_attempts = QUIZ.attempts; return { attempt: QUIZ.attempts, passed: 1 }; });
}

// ------------------------------------------------------------------ full screen (D08; v1.5 message from your screenshot)
// From the "Enter full screen" click until the save step, leaving full screen covers the page at once with "Please use
// full screen" and a button to go back, on any screen. Keys do nothing while it is up, so F or J cannot answer for objects
// the person cannot see. Exits during the task are counted (fullscreen_exits). Before each trial and the practice, the
// study also waits until the page is back in full screen (fullscreenWait).
let FS_OVERLAY_ON = false;
function requestFullscreen() {
  const el = document.documentElement;
  const p = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null;
  if (p && p.catch) p.catch(() => {});
}
function fsOverlayVisible() { return !!document.getElementById("fs-overlay"); }
function showFsOverlay() {
  if (fsOverlayVisible()) return;
  const ov = document.createElement("div");
  ov.id = "fs-overlay";
  ov.innerHTML = `<p class="fs-ov-title">Please use full screen</p>
    <p class="fs-ov-text">You have left full-screen mode. This experiment must be completed in full screen.<br>Please click the button below to return to full screen and continue.</p>
    <button class="jspsych-btn fs-ov-btn" id="fs-overlay-btn">Return to full screen</button>`;
  ov.addEventListener("click", (e) => e.stopPropagation());     // a click here does not reach the screen underneath
  document.body.appendChild(ov);
  ov.querySelector("#fs-overlay-btn").onclick = requestFullscreen;
}
function hideFsOverlay() { const ov = document.getElementById("fs-overlay"); if (ov) ov.remove(); }
function installFullscreenWatch() {
  if (window.__fsListener) return;
  window.__fsListener = true;
  const onChange = () => {
    if (isFullscreen()) { hideFsOverlay(); return; }
    if (SESSION.task_started) SESSION.fullscreen_exits += 1;
    if (FS_OVERLAY_ON) showFsOverlay();
  };
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  const block = (e) => { if (fsOverlayVisible()) { e.stopImmediatePropagation(); e.preventDefault(); } };
  window.addEventListener("keydown", block, true);
  window.addEventListener("keyup", block, true);
}
// Before every trial: if the page is not in full screen, show the message and wait until it is.
function fullscreenWait() {
  return {
    timeline: [{
      type: jsPsychCallFunction, async: true, data: { phase: "fullscreen_reentry" },
      func: (done) => {
        const t0 = performance.now();
        showFsOverlay();
        const check = () => {
          if (!isFullscreen()) return;
          document.removeEventListener("fullscreenchange", check);
          document.removeEventListener("webkitfullscreenchange", check);
          done({ wait_ms: Math.round(performance.now() - t0) });
        };
        document.addEventListener("fullscreenchange", check);
        document.addEventListener("webkitfullscreenchange", check);
      },
    }],
    conditional_function: () => MODE === "live" && !isFullscreen(),
  };
}

// ------------------------------------------------------------------ data output
const TRIAL_COLS = ["subject_id", "sona_id", "list", "trial_number", "phase", "trial_kind", "stim_id",
  "scene_label", "object_label", "congruency", "analyzed_stimulus", "scene_file", "target_file", "foil_file",
  "target_side", "left_file", "right_file", "left_text", "right_text", "correct_key", "response_key",
  "accuracy", "rt_ms", "timed_out",
  "fixation1_intended_ms", "fixation1_intended_frames", "fixation1_frame_rounded_ms", "fixation1_measured_ms",
  "scene_intended_ms", "scene_intended_frames", "scene_frame_rounded_ms", "scene_measured_ms",
  "fixation2_intended_ms", "fixation2_intended_frames", "fixation2_frame_rounded_ms", "fixation2_measured_ms",
  "fixation1_dropped_frames", "scene_dropped_frames", "fixation2_dropped_frames", "brief_screens_within_one_frame",
  "response_screen_ms", "response_onset_ts",
  "early_presses", "rushed", "checkin_after",
  "frame_ms", "scene_px", "option_w_px", "option_h_px", "fullscreen_at_end", "hidden_during_trial", "time_elapsed"];
const SESSION_COLS = ["subject_id", "sona_id", "version", "mode", "start_time", "end_time", "refresh_hz", "frame_ms",
  "frame_sd_ms", "vsync_rate_browsercheck", "scene_scale", "response_scale", "scene_px", "option_w_px", "option_h_px",
  "screen_width", "screen_height",
  "window_width", "window_height", "device_pixel_ratio", "browser", "browser_version", "os", "fullscreen_exits",
  "n_task_trials", "n_main_timeouts", "catch_correct", "n_brief_screen_timing_off", "n_rushed_trials", "n_checkins_no_response",
  "n_checkins_rushed", "quiz_attempts", "practice_attempts", "practice_passed", "native_language", "years_english", "user_agent"];

function outputs(jsPsych) {
  const trials = jsPsych.data.get().filter({ phase: "task" }).values().map((r) => ({ ...r, list: "none" }));
  const lang = jsPsych.data.get().filter({ phase: "language" }).values()[0];
  const bc = jsPsych.data.get().filter({ phase: "browser_check" }).values()[0] || {};
  Object.assign(SESSION, {
    end_time: new Date().toISOString(),
    scene_px: SIZES.scene_px, option_w_px: SIZES.option_w_px, option_h_px: SIZES.option_h_px,
    browser: bc.browser, browser_version: bc.browser_version, os: bc.os,
    n_task_trials: trials.length,
    n_main_timeouts: trials.filter((t) => t.trial_kind === "main" && t.timed_out === 1).length,
    catch_correct: trials.filter((t) => t.trial_kind === "catch" && t.accuracy === 1).length,
    n_brief_screen_timing_off: trials.filter((t) => t.brief_screens_within_one_frame === 0).length,
    n_rushed_trials: trials.filter((t) => t.rushed === 1).length,
    native_language: lang ? lang.response.native_language : "", years_english: lang ? lang.response.years_english : "",
  });
  return {
    trials_csv: toCSV(trials, TRIAL_COLS),
    session_csv: toCSV([SESSION], SESSION_COLS),
    raw_json: jsPsych.data.get().json(),
    trials, session: { ...SESSION },
  };
}

// ------------------------------------------------------------------ timeline
function buildTimeline(jsPsych) {
  SESSION.subject_id = jsPsych.randomization.randomID(10);
  jsPsych.data.addProperties({ subject_id: SESSION.subject_id, sona_id: SESSION.sona_id, version: CONFIG.version });
  const list = buildTrialList(jsPsych);
  const allImages = TASK_STIMULI.flatMap((m) => [m.scene, m.target, m.lure]).concat(CATCH_STIMULI.map((c) => c.scene))
    .concat([CONFIG.demo.scene_circled, CONFIG.demo.target, CONFIG.demo.lure]);
  const tl = [];
  const sim = MODE === "simulate";

  // 1. Device and browser check (S20; D08). Phones and tablets are stopped before anything else.
  if (!sim) tl.push({
    type: jsPsychCallFunction, data: { phase: "device_check" },
    func: () => {
      const blocked = isPhoneOrTablet();
      if (blocked) jsPsych.abortExperiment("<div class='textpage'><p>This study needs a laptop or desktop computer with a keyboard and a mouse or trackpad. Please open the link on a computer.</p></div>");
      return { phone_or_tablet: blocked ? 1 : 0, max_touch_points: navigator.maxTouchPoints };
    },
  });
  tl.push({
    type: jsPsychBrowserCheck,
    features: ["width", "height", "browser", "browser_version", "mobile", "os", "fullscreen", "vsync_rate"],
    vsync_frame_count: CONFIG.refresh_sample_frames,
    minimum_width: CONFIG.min_window_width_px, minimum_height: CONFIG.min_window_height_px,
    window_resize_message: `<p>Your browser window is too small. Please make it larger.</p>
      <p>Width: <span id="browser-check-min-width"></span> needed, now <span id="browser-check-actual-width"></span>.<br>
      Height: <span id="browser-check-min-height"></span> needed, now <span id="browser-check-actual-height"></span>.</p>`,
    inclusion_function: (d) => !d.mobile && d.fullscreen && d.width >= CONFIG.min_window_width_px && d.height >= CONFIG.min_window_height_px,
    exclusion_message: (d) => d.mobile
      ? "<p>This study needs a laptop or desktop computer with a keyboard. Please open the link on a computer.</p>"
      : !d.fullscreen
        ? "<p>Your browser cannot show this study in full screen. Please try Chrome, Firefox, Edge or Safari on a computer.</p>"
        : "<p>Your browser window is too small for this study. Please try again on a larger screen or with a larger window.</p>",
    data: { phase: "browser_check" },
    on_finish: (d) => { SESSION.vsync_rate_browsercheck = d.vsync_rate; },
  });

  // 2. Full screen first, as in the lab template (D08)
  tl.push({
    type: jsPsychFullscreen, fullscreen_mode: true,
    message: `<div class="fs-screen"><p class="fs-title">This experiment runs in full screen</p>
      <p class="fs-text">This experiment must be completed in full-screen mode. Please click the button below to switch to full screen before you begin.</p></div>`,
    button_label: "Enter full screen", data: { phase: "fullscreen_enter" },
    on_finish: () => { installFullscreenWatch(); FS_OVERLAY_ON = MODE === "live"; },
  });

  // 3. Introduction ("Click anywhere to continue")
  tl.push(customScreen(jsPsych, "intro", (el, done) => {
    el.innerHTML = pageHTML("Welcome to the experiment!", `<h2>Introduction</h2>
      <p>Before we begin, please make sure that:</p>
      <ul><li>You are doing this experiment on a laptop or desktop computer</li>
        <li>Using full screen to display the task</li>
        <li>If you encounter any problems during this task, please send an email to: <b>${CONFIG.contact_email}</b></li>
        <li>Next, you will get to read a consent form and decide whether you want to participate in this study</li></ul>
      <p class="pg-hint">Click anywhere to continue</p>`);
    const t0 = performance.now();
    setTimeout(() => {
      const onClick = () => { document.removeEventListener("click", onClick); done({ rt: Math.round(performance.now() - t0) }); };
      document.addEventListener("click", onClick);
    }, 300);
  }));

  // 4. Consent: the lab's UCSD form (config.js); clicking the green text accepts. Not accepting = closing the page.
  tl.push(customScreen(jsPsych, "consent", (el, done) => {
    el.innerHTML = `<div class="pg-header" style="font-size:24px">Univ. of California, San Diego, Consent to Participate in Research: Please read, then click the green text at the bottom to accept and continue</div>
      <div class="pg-wrap" style="padding-top:110px"><div class="pg-box pg-consent">${CONFIG.consent_html}
      <a class="pg-accept" id="pg-accept" href="#">${CONFIG.consent_accept_text}</a></div></div>`;
    const t0 = performance.now();
    el.querySelector("#pg-accept").onclick = (e) => { e.preventDefault(); done({ consented: 1, rt: Math.round(performance.now() - t0) }); };
  }, () => ({ consented: 1 })));

  // 5. Load every image before the task (S32, S112)
  tl.push({
    type: jsPsychPreload, images: allImages, show_progress_bar: true,
    message: `<div class="pg-header">Loading</div><p style="font-family:Arial,Helvetica,sans-serif;font-size:20px">Loading the pictures. This can take up to a minute.</p>`,
    error_message: "<p>Some pictures did not load. Please check your internet connection and reload the page.</p>",
    data: { phase: "preload" },
  });

  // 6. Refresh rate (D07)
  tl.push({
    type: jsPsychCallFunction, async: true, data: { phase: "refresh" },
    func: (done) => measureRefresh(CONFIG.refresh_sample_frames).then((r) => {
      Object.assign(SESSION, { frame_ms: r.frame_ms, refresh_hz: r.refresh_hz, frame_sd_ms: r.frame_sd_ms });
      done(r);
    }),
  });

  // 7. Image sizes for this window (D05; no calibration, as in the original)
  tl.push({ type: jsPsychCallFunction, data: { phase: "sizes" }, func: () => { applySizes(); return { ...SIZES, scene_scale: SESSION.scene_scale, response_scale: SESSION.response_scale }; } });

  // 8. Instructions, practice trial and comprehension check, repeated until every answer is right (D09, D25, D26)
  tl.push({
    timeline: [
      pagedScreen(jsPsych, "instructions",
        () => (QUIZ.attempts === 0 ? "Welcome to the experiment!" : "Please read the instructions again"),
        () => (QUIZ.attempts === 0 ? [] : [{ title: "Please read again",
          text: "<p>Some of your answers were not right.</p><p>Please read all the instructions again. Then answer the questions again.</p>" }])
          .concat(instructionPages()),
        "Start practice"),
      ...practiceNode(jsPsych),
      quizScreen(jsPsych),
    ],
    loop_function: () => !QUIZ.passed,
  });

  // 9. Ready screen; the task starts on Start
  tl.push(customScreen(jsPsych, "ready", (el, done) => {
    el.innerHTML = pageHTML("Well done!", `<h2>You are ready to begin</h2>
      <p>You answered all the questions correctly.</p>
      <p>The task takes about 8 minutes, with no breaks.</p>
      <p>When you press <b>Start</b>, the first trial begins right away, so get ready: look at the middle of the screen and keep your fingers on <b>F</b> and <b>J</b>.</p>
      <div class="pg-nav"><button class="pg-btn" id="pg-start">Start</button></div>`);
    el.querySelector("#pg-start").onclick = () => done({});
  }));
  tl.push({ type: jsPsychCallFunction, data: { phase: "task_start" }, func: () => { SESSION.task_started = true; LEAVE_WARNING = true; return {}; } });

  // 10. Task: 89 main + 6 catch trials (S68, S73, S74; stimulus 72 removed, D27) and no breaks (S76)
  list.forEach((item, i) => {
    tl.push(fullscreenWait()); tl.push(makeTrial(jsPsych, item, i));
    if (i < list.length - 1) tl.push(checkInNode(jsPsych));   // P8, P9 (D23, D24); none after the last trial
  });
  tl.push({ type: jsPsychCallFunction, func: () => { SESSION.task_started = false; return {}; }, data: { phase: "task_end" } });

  // 11. Language questions (proposed addition P2, approved 4 Nov; D15)
  tl.push(sim
    ? { type: jsPsychCallFunction, data: { phase: "language" }, func: () => ({}),
        on_finish: (d) => { d.response = { native_language: "English", years_english: "20" }; } }
    : { type: jsPsychSurveyHtmlForm, data: { phase: "language" }, button_label: "Continue",
        html: pageHTML("Almost done!", `<h2>Two last questions</h2>
          <p><label>What is your native language (the first language you learned)?<br>
             <input name="native_language" type="text" required style="width:20em;font-size:18px;padding:4px"></label></p>
          <p><label>For how many years have you spoken English?<br>
             <input name="years_english" type="number" min="0" max="100" required style="width:6em;font-size:18px;padding:4px"></label></p>`, "", false) });

  // 12. Save (DataPipe, D21) or hand the data to the simulation runner
  tl.push({
    type: jsPsychCallFunction, async: true, data: { phase: "save" },
    func: (done) => {
      SESSION.completed = true;
      FS_OVERLAY_ON = false; hideFsOverlay();              // the full-screen message stops here
      const out = outputs(jsPsych);
      SAVED_OUT = out;
      if (MODE !== "live") { (window.__SIM_OUT = window.__SIM_OUT || []).push(out); done({ saved: "local" }); return; }
      const el = jsPsych.getDisplayElement();
      el.innerHTML = "<p>Saving your data. Please do not close this page.</p>";
      const base = `exp1a_${CONFIG.version}_${SESSION.subject_id}`;
      const files = [[`${base}_trials.csv`, out.trials_csv], [`${base}_session.csv`, out.session_csv], [`${base}_raw.json`, out.raw_json]];
      // plugin-pipe returns an Error object (it does not throw) when the request fails, and has no time
      // limit, so each attempt is checked and capped at 20 s. Retries use a new filename so a save that
      // went through but lost its reply is not reported as "file exists".
      const withTimeout = (p, ms) => Promise.race([p, new Promise((res) => setTimeout(() => res(new Error("timeout")), ms))]);
      const saveOne = async ([name, text]) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const fname = attempt === 0 ? name : name.replace(/(\.[a-z]+)$/, `_retry${attempt}$1`);
          let r;
          try { r = await withTimeout(jsPsychPipe.saveData(CONFIG.datapipe_id, fname, text), 20000); } catch (e) { r = e; }
          if (r && !(r instanceof Error) && !r.error) return true;
          await new Promise((res) => setTimeout(res, 1500));
        }
        return false;
      };
      (async () => {
        const ok = [];
        for (const f of files) ok.push(await saveOne(f));
        SESSION.save_ok = ok.every(Boolean) ? 1 : 0;
        LEAVE_WARNING = false;
        done({ saved: ok });
      })();
    },
  });

  // 13. Debrief, then SONA credit (draft text and placeholder URL in config.js)
  tl.push({
    type: jsPsychHtmlButtonResponse, data: { phase: "debrief" },
    choices: () => (SESSION.save_ok === 0 ? ["Download my data", "Finish"] : ["Finish"]),
    on_finish: (d) => {
      if (SESSION.save_ok === 0 && d.response === 0) {
        downloadTrials();
      }
    },
    stimulus: () => {
      const s = jsPsych.data.get().filter({ phase: "save" }).last(1).values()[0];
      const failed = s && Array.isArray(s.value && s.value.saved) && s.value.saved.some((x) => !x);
      return pageHTML("Thank you!", `${CONFIG.debrief_html}${failed
        ? `<p style="color:#a00">Your data did not save to our server. Please click <b>Download my data</b> below and email the file to ${CONFIG.contact_email || "the researcher"} with this code: <b>${SESSION.subject_id}</b>. You will still get credit.</p>` : ""}`, "", false);
    },
  });
  return tl;
}

// ------------------------------------------------------------------ run
function finishLive(jsPsych) {
  exitFullscreen();
  // Only people who finished the task and reached the save step are sent to SONA for credit.
  // Anyone who declined consent or was turned away by the device check keeps the message on screen.
  if (!SESSION.completed) return;
  const creditUrl = CONFIG.sona_credit_url && SESSION.sona_id ? CONFIG.sona_credit_url + encodeURIComponent(SESSION.sona_id) : "";
  const contact = CONFIG.contact_email || "the researcher";
  if (SESSION.save_ok === 0) {
    // Saving failed: stay on this page, keep the download button, and give the code to email.
    // The person is not sent to SONA automatically, so the download is not interrupted.
    document.body.innerHTML = `<div class="textpage" style="margin:15vh auto">
      <p>Thank you. Your data did not save to our server.</p>
      <p>Please click <b>Download my data</b>, then email the file to ${contact} with this code: <b>${SESSION.subject_id}</b>. You will still get credit.</p>
      <p><button class="jspsych-btn" id="dl-again">Download my data</button></p>
      ${creditUrl ? `<p><a href="${creditUrl}">Get my SONA credit</a></p>` : ""}</div>`;
    document.getElementById("dl-again").addEventListener("click", downloadTrials);
  } else if (creditUrl) {
    window.location.href = creditUrl;
  } else {
    document.body.innerHTML = `<div class="textpage" style="margin:15vh auto"><p>Thank you. You can close this page now.</p>${SESSION.sona_id ? ""
      : `<p>We could not find your SONA ID in the study link. To get credit, email ${contact} with this code: <b>${SESSION.subject_id}</b>.</p>`}</div>`;
  }
}

async function runSimulations(n) {
  window.__SIM_OUT = [];
  for (let k = 0; k < n; k++) {
    const jsPsych = initJsPsych();
    SIM_OFFSET = jsPsych.randomization.sampleNormal(0, 0.42);
    Object.assign(CHECKIN, { misses: 0, recent: [], pending: null });
    Object.assign(QUIZ, { attempts: 0, passed: false });
    Object.assign(PRACTICE, { attempts: 0, passed: false, triesThisPass: 0, passedThisPass: false });
    Object.assign(SESSION, { fullscreen_exits: 0, n_checkins_no_response: 0, n_checkins_rushed: 0, quiz_attempts: 0,
      practice_attempts: 0, practice_passed: 0,
      scene_scale: null, response_scale: null, frame_ms: 1000 / 60, completed: false, save_ok: null,
      start_time: new Date().toISOString(), sona_id: `SIM${String(k + 1).padStart(4, "0")}` });
    await jsPsych.simulate(buildTimeline(jsPsych), "data-only");
  }
  window.__SIM_DONE = true;
}

async function runTimingCheck(nTrials, auto) {
  const jsPsych = initJsPsych();
  SESSION.subject_id = "timingcheck";
  applySizes();   // same size rule as the task
  const list = buildTrialList(jsPsych).filter((x) => x.kind === "main").slice(0, nTrials);
  const tl = [];
  if (!auto) tl.push({ type: jsPsychFullscreen, fullscreen_mode: true, simulation_options: { simulate: false },
    message: "<p>Timing check: 20 trials will run by themselves (about 1.5 minutes). Do not touch the keyboard.</p>",
    button_label: "Start" });
  tl.push({ type: jsPsychCallFunction, async: true, simulation_options: { simulate: false },
    func: (done) => measureRefresh(CONFIG.refresh_sample_frames).then((r) => { Object.assign(SESSION, { frame_ms: r.frame_ms, refresh_hz: r.refresh_hz, frame_sd_ms: r.frame_sd_ms }); done(r); }) });
  list.forEach((item, i) => tl.push(makeTrial(jsPsych, item, i)));
  await jsPsych.simulate(tl, "visual");
  const rows = jsPsych.data.get().filter({ phase: "task" }).values();
  const frame = SESSION.frame_ms;
  const summary = ["fixation1", "scene", "fixation2"].map((n) => {
    const err = rows.map((r) => r[`${n}_measured_ms`] - r[`${n}_frame_rounded_ms`]);
    return { screen: n, trials: rows.length, mean_error_ms: err.reduce((a, b) => a + b, 0) / err.length,
      max_abs_error_ms: Math.max(...err.map(Math.abs)), within_one_frame: err.filter((e) => Math.abs(e) <= frame).length };   // same rule as the per-trial flag
  });
  window.__TIMING = { refresh_hz: SESSION.refresh_hz, frame_ms: frame, frame_sd_ms: SESSION.frame_sd_ms, summary, rows, user_agent: navigator.userAgent };
  exitFullscreen();
  const csv = toCSV(rows, TRIAL_COLS);
  document.body.innerHTML = `<div class="textpage" style="margin:5vh auto">
    <h2>Timing check</h2>
    <p>Refresh rate: <b>${SESSION.refresh_hz.toFixed(1)} Hz</b> (one frame = ${frame.toFixed(2)} ms, SD ${SESSION.frame_sd_ms.toFixed(2)} ms)</p>
    <table class="tc"><tr><th>Screen</th><th>Trials</th><th>Mean error (ms)</th><th>Largest error (ms)</th><th>Within one frame</th></tr>
    ${summary.map((s) => `<tr><td>${s.screen}</td><td>${s.trials}</td><td>${s.mean_error_ms.toFixed(2)}</td><td>${s.max_abs_error_ms.toFixed(2)}</td><td>${s.within_one_frame} of ${s.trials}</td></tr>`).join("")}
    </table>
    <p>Error = measured duration minus intended duration after rounding to whole frames. A pass is every trial within one frame.</p>
    <p><b>${summary.every((s) => s.within_one_frame === s.trials) ? "PASS" : "CHECK: some screens were off by more than one frame"}</b></p>
    <p><a id="dl" download="timingcheck.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}">Download the trial data (CSV)</a></p></div>`;
  window.__TIMING_DONE = true;
}

window.addEventListener("load", () => {
  if (MODE === "simulate") { runSimulations(parseInt(URLP.get("sessions") || "1", 10)); return; }
  if (MODE === "timingcheck") { runTimingCheck(parseInt(URLP.get("trials") || "20", 10), URLP.get("auto") === "1"); return; }
  // jsPsych runs on <body>, so key presses reach it even after a button click has moved the focus
  // (in v1.0 a separate display div missed them).
  const jsPsych = initJsPsych({ on_finish: () => finishLive(jsPsych) });
  window.jsPsychInstance = jsPsych;   // lets the browser console (and the test scripts) read the data so far
  // Warn before leaving the page in the middle of the task; leaving loses the data.
  window.addEventListener("beforeunload", (e) => {
    if (LEAVE_WARNING) { e.preventDefault(); e.returnValue = ""; }
  });
  jsPsych.run(buildTimeline(jsPsych));
});
