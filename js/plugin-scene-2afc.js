// jsPsych 8 plugin: one exemplar-identification trial of Su et al. (2025) Exp 1a, frame-locked.
// Screens (S57-S61): fixation -> scene -> fixation -> two-choice response (F = left, J = right).
// Every brief screen is shown for a whole number of display frames (D07). Each screen's onset is
// the requestAnimationFrame (rAF) timestamp of the first frame after the screen was drawn, and its
// measured duration is the next screen's onset minus its own onset.
var jsPsychScene2AFC = (function (jspsych) {
  "use strict";
  const T = jspsych.ParameterType;

  const info = {
    name: "scene-2afc",
    version: "1.0.0",
    parameters: {
      trial_kind: { type: T.STRING, default: "main" },          // "main" or "catch"
      scene: { type: T.IMAGE, default: undefined },
      left_image: { type: T.IMAGE, default: null },              // main trials
      right_image: { type: T.IMAGE, default: null },
      question_html: { type: T.HTML_STRING, default: "" },       // catch trials
      left_text: { type: T.STRING, default: "" },
      right_text: { type: T.STRING, default: "" },
      correct_key: { type: T.STRING, default: undefined },
      key_left: { type: T.STRING, default: "f" },
      key_right: { type: T.STRING, default: "j" },
      fixation1_ms: { type: T.FLOAT, default: 900 },
      scene_ms: { type: T.FLOAT, default: 2500 },
      fixation2_ms: { type: T.FLOAT, default: 500 },
      response_limit_ms: { type: T.FLOAT, default: 2500 },
      frame_ms: { type: T.FLOAT, default: 1000 / 60 },
      scene_px: { type: T.FLOAT, default: 400 },
      option_w_px: { type: T.FLOAT, default: 400 },
      option_h_px: { type: T.FLOAT, default: 300 },
      fixation_px: { type: T.FLOAT, default: 16 },
      fixation_line_px: { type: T.FLOAT, default: 3 },
      text_px: { type: T.FLOAT, default: 40 },
      background: { type: T.STRING, default: "#ffffff" },
      sim_p_correct: { type: T.FLOAT, default: 0.75 },            // used only in simulation
    },
    data: {},
  };

  class Scene2AFCPlugin {
    constructor(jsPsych) { this.jsPsych = jsPsych; }

    trial(display_element, trial, on_load) {
      const jsp = this.jsPsych;
      const frame = trial.frame_ms;
      const isCatch = trial.trial_kind === "catch";
      const intended = [trial.fixation1_ms, trial.scene_ms, trial.fixation2_ms];
      const nFrames = intended.map((ms) => Math.max(1, Math.round(ms / frame)));
      const names = ["fixation1", "scene", "fixation2"];

      // ---- build every screen once, hidden; switching screens only toggles display
      const fl = trial.fixation_line_px, fs = trial.fixation_px;
      const respInner = isCatch
        ? `<div style="width:${2 * trial.option_w_px}px;height:${trial.option_h_px}px;position:relative;font-weight:700;color:#000;font-size:${trial.text_px}px;font-family:Arial,Helvetica,sans-serif;">
             <div style="position:absolute;top:22%;width:100%;text-align:center;">${trial.question_html}</div>
             <div style="position:absolute;top:62%;left:16%;">${trial.key_left}. ${trial.left_text}</div>
             <div style="position:absolute;top:62%;left:66%;">${trial.key_right}. ${trial.right_text}</div>
           </div>`
        : `<img src="${trial.left_image}" style="width:${trial.option_w_px}px;height:${trial.option_h_px}px;display:block;">
           <img src="${trial.right_image}" style="width:${trial.option_w_px}px;height:${trial.option_h_px}px;display:block;">`;
      display_element.innerHTML = `
        <div id="s2-stage" style="position:fixed;inset:0;background:${trial.background};display:flex;align-items:center;justify-content:center;cursor:none;">
          <div id="s2-fix" style="position:relative;width:${fs}px;height:${fs}px;display:none;">
            <div style="position:absolute;left:0;top:${(fs - fl) / 2}px;width:${fs}px;height:${fl}px;background:#000;"></div>
            <div style="position:absolute;top:0;left:${(fs - fl) / 2}px;width:${fl}px;height:${fs}px;background:#000;"></div>
          </div>
          <img id="s2-scene" src="${trial.scene}" style="width:${trial.scene_px}px;height:${trial.scene_px}px;display:none;">
          <div id="s2-resp" style="display:none;flex-direction:row;align-items:center;justify-content:center;">${respInner}</div>
        </div>`;
      const el = {
        fix: display_element.querySelector("#s2-fix"),
        scene: display_element.querySelector("#s2-scene"),
        resp: display_element.querySelector("#s2-resp"),
      };
      const show = (p) => {
        el.fix.style.display = p === 0 || p === 2 ? "block" : "none";
        el.scene.style.display = p === 1 ? "block" : "none";
        el.resp.style.display = p === 3 ? "flex" : "none";
      };

      // ---- state
      let phase = -1;               // -1 nothing drawn yet; 0..3 = screen index; 4 = blank after a timeout
      const onsets = [null, null, null, null, null];   // visible onsets (first frame after drawing); [4] = blank
      const callbacks = [0, 0, 0, 0];            // rAF callbacks while each screen was visible
      let lastTs = null, visible = -1;
      const dropped = [0, 0, 0, 0];              // skipped frames, charged to the screen on display at the time
      let hiddenDuring = document.visibilityState === "hidden";
      const onVis = () => { if (document.visibilityState === "hidden") hiddenDuring = true; };
      document.addEventListener("visibilitychange", onVis);
      let listener = null, tListen = null, finished = false;
      // F or J presses made while the + or the photo is on screen, before the two options appear.
      // They are ignored as answers but counted (early_presses), for the "rushed" check-in (P9, D24).
      let earlyPresses = 0;
      const onEarlyKey = (e) => {
        if (e.repeat || onsets[0] === null || onsets[3] !== null) return;
        const k = (e.key || "").toLowerCase();
        if (k === trial.key_left || k === trial.key_right) earlyPresses += 1;
      };
      document.addEventListener("keydown", onEarlyKey);
      // v1.6: use the study's own check (page AND window, experiment.js) when it is there, so a trial ended after the
      // green button records fullscreen_at_end = 0
      const isFullscreen = () => (typeof window.isFullscreen === "function" ? window.isFullscreen()
        : !!(document.fullscreenElement || document.webkitFullscreenElement));

      const finish = (resp) => {
        if (finished) return;
        finished = true;
        if (listener) jsp.pluginAPI.cancelKeyboardResponse(listener);
        document.removeEventListener("visibilitychange", onVis);
        document.removeEventListener("keydown", onEarlyKey);
        const data = {
          trial_kind: trial.trial_kind,
          correct_key: trial.correct_key,
          response_key: resp ? resp.key.toLowerCase() : null,
          accuracy: resp ? (resp.key.toLowerCase() === trial.correct_key ? 1 : 0) : null,
          rt_ms: resp ? resp.rt_from_onset : null,
          timed_out: resp ? 0 : 1,
          // how long the options were on screen: the RT if answered, onset-to-blank if timed out
          response_screen_ms: resp ? resp.rt_from_onset : onsets[4] - onsets[3],
          frame_ms: frame,
          scene_px: trial.scene_px, option_w_px: trial.option_w_px, option_h_px: trial.option_h_px,
          fullscreen_at_end: isFullscreen() ? 1 : 0,
          hidden_during_trial: hiddenDuring ? 1 : 0,
          response_onset_ts: onsets[3],
          early_presses: earlyPresses,
        };
        let ok = 1;
        for (let i = 0; i < 3; i++) {
          const measured = onsets[i + 1] - onsets[i];
          data[`${names[i]}_intended_ms`] = intended[i];
          data[`${names[i]}_intended_frames`] = nFrames[i];
          data[`${names[i]}_frame_rounded_ms`] = nFrames[i] * frame;
          data[`${names[i]}_measured_ms`] = measured;
          data[`${names[i]}_callbacks`] = callbacks[i];
          data[`${names[i]}_dropped_frames`] = dropped[i];
          if (!(Math.abs(measured - nFrames[i] * frame) <= frame)) ok = 0;
        }
        data.brief_screens_within_one_frame = ok;   // flag only; not used to exclude trials
        display_element.innerHTML = "";
        jsp.finishTrial(data);
      };

      // Listen for F/J only from the first frame on which the options are visible (D22), so a key pressed
      // before the options appear is ignored. RT runs from that frame.
      const startListening = () => {
        tListen = performance.now();
        listener = jsp.pluginAPI.getKeyboardResponse({
          callback_function: (info) => finish({ key: info.key, rt_from_onset: tListen + info.rt - onsets[3] }),
          valid_responses: [trial.key_left, trial.key_right],
          rt_method: "performance",
          persist: false,
          allow_held_key: false,
        });
      };

      const step = (ts) => {
        if (finished) return;
        // frames skipped since the last callback belong to the screen that was on display meanwhile
        if (lastTs !== null && visible >= 0 && ts - lastTs > 1.5 * frame) dropped[visible] += Math.round((ts - lastTs) / frame) - 1;
        lastTs = ts;
        if (phase === -1) {                       // draw the first fixation
          phase = 0; show(0);
          requestAnimationFrame(step); return;
        }
        if (phase === 4) { onsets[4] = ts; finish(null); return; }   // the blank after a timeout is now visible
        if (onsets[phase] === null) {             // first frame on which this screen is visible
          onsets[phase] = ts; visible = phase;
          if (phase === 3) {
            startListening();
            if (this._sim) this.jsPsych.pluginAPI.pressKey(this._sim.key, this._sim.rt);
          }
        }
        callbacks[phase] += 1;
        // Change screens when the current one has been visible for (n - 1) frames: the next screen
        // then appears on the following frame, so the current one stays up for exactly n frames.
        // The response screen is removed the same way, so it is visible for the full response limit.
        const limit = phase < 3 ? nFrames[phase] * frame : trial.response_limit_ms;
        if (ts - onsets[phase] >= limit - 1.5 * frame) { phase += 1; show(phase); }
        requestAnimationFrame(step);
      };

      // decode every image before the first frame so nothing is decoded mid-trial
      // (jsPsych calls on_load itself for real trials, so it is not called here)
      const imgs = Array.from(display_element.querySelectorAll("img"));
      Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => null) : null))).then(() => {
        requestAnimationFrame(step);
      });
    }

    simulate(trial, simulation_mode, simulation_options, load_callback) {
      const correct = Math.random() < trial.sim_p_correct;
      const other = trial.correct_key === trial.key_left ? trial.key_right : trial.key_left;
      const key = correct ? trial.correct_key : other;
      const rt = Math.round(Math.min(2400, 350 + this.jsPsych.randomization.sampleExGaussian(450, 90, 1 / 250, true)));
      const timeout = Math.random() < 0.02;
      if (simulation_mode === "visual") {
        this._sim = timeout ? null : { key, rt };
        this.trial(this.jsPsych.getDisplayElement(), trial, null);
        if (load_callback) load_callback();
        return;
      }
      // data-only: durations equal the frame-rounded intended durations
      const frame = trial.frame_ms;
      const intended = [trial.fixation1_ms, trial.scene_ms, trial.fixation2_ms];
      const names = ["fixation1", "scene", "fixation2"];
      const data = {
        trial_kind: trial.trial_kind, correct_key: trial.correct_key,
        response_key: timeout ? null : key, accuracy: timeout ? null : (correct ? 1 : 0),
        rt_ms: timeout ? null : rt, timed_out: timeout ? 1 : 0, frame_ms: frame,
        scene_px: trial.scene_px, option_w_px: trial.option_w_px, option_h_px: trial.option_h_px,
        fullscreen_at_end: 1, hidden_during_trial: 0, response_onset_ts: null,
        response_screen_ms: timeout ? trial.response_limit_ms : rt, brief_screens_within_one_frame: 1, early_presses: 0,
      };
      intended.forEach((ms, i) => {
        const n = Math.max(1, Math.round(ms / frame));
        Object.assign(data, {
          [`${names[i]}_intended_ms`]: ms, [`${names[i]}_intended_frames`]: n,
          [`${names[i]}_frame_rounded_ms`]: n * frame, [`${names[i]}_measured_ms`]: n * frame,
          [`${names[i]}_callbacks`]: n, [`${names[i]}_dropped_frames`]: 0,
        });
      });
      const merged = this.jsPsych.pluginAPI.mergeSimulationData(data, simulation_options);
      if (load_callback) load_callback();
      this.jsPsych.finishTrial(merged);
    }
  }
  Scene2AFCPlugin.info = info;
  return Scene2AFCPlugin;
})(jsPsychModule);
