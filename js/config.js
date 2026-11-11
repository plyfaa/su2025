// Su, Qiu & Ding (2025) Experiment 1a, online replication. Version v1.7.
// Every setting lives here. Spec rows (S##) are in Su2025_Exp1a_spec workbook, "Spec" tab.
// Deviations (D##) are in its "Deviations log" tab.

const CONFIG = {
  version: "v1.7",

  // ---------------------------------------------------------------- data and credit
  datapipe_id: "41EFAQ4kziJG",                  // DataPipe experiment ID (given 4 Nov 2026)
  // Paste the SONA credit-granting URL here once SONA approves the study. Keep "survey_code="
  // at the end; the participant's SONA ID is appended to it. While this is empty, the last
  // screen says thank you and does not redirect.
  sona_credit_url: "",
  // URL parameter names the SONA ID may arrive under (SONA study URL should end in ?sona_id=%SURVEY_CODE%).
  sona_id_params: ["sona_id", "id", "survey_code", "SONA_ID"],
  // v1.7: which sample a session belongs to, taken from the link (&sample=pilotA). Letters, digits and hyphens only.
  // The SONA link has no sample parameter, so real participants get default_sample. It goes into the file names
  // and into a "sample" column, so test runs and pilots can be kept out of the main analysis.
  sample_param: "sample",
  default_sample: "main",
  // Shown to participants if saving fails or the link had no SONA ID. Put your study email here.
  contact_email: "psuwanamalikmurphy@ucsd.edu",   // shown on the introduction page, and if saving fails or the link has no SONA ID

  // ---------------------------------------------------------------- trial timing (ms)
  fixation1_min_ms: 800,                        // S57: "800-1,000 ms, randomly selected from a uniform distribution" (text chosen over Figure 2B's 500-800; D12)
  fixation1_max_ms: 1000,                       // S57
  scene_ms: 2500,                               // S58: "a scene display lasting 2,500 ms"
  fixation2_ms: 500,                            // S59: "After another fixation cross (500 ms)"
  response_limit_ms: 2500,                      // S63: Figure 2B "Max. 2,500ms"
  // S60: no mask. S65: no feedback (not reported; D13). S66: no gap between trials beyond the fixation.

  // ---------------------------------------------------------------- response keys
  key_left: "f",                                // S62: "pressed "F" for left"
  key_right: "j",                               // S62: "and "J" for right"

  // ---------------------------------------------------------------- display sizes (pixels; D05)
  // No calibration (removed in v1.3 at your request; the original had none). Each image is shown at its
  // file size in CSS pixels and shrunk to fit the window if it is larger. S25, S26, S28 not reported.
  scene_px: 500,                                // scene files are 500 x 500 (author files)
  option_w_px: 1024,                            // option files are 1024 x 768 (author files); two side by side = 2048 x 768,
  option_h_px: 768,                             //   the size of the authors' catch answer screens, so this screen nearly always shrinks
  fit_margin: 0.96,                             // fraction of the window an image may fill
  fixation_px: 20,                              // S28 size not reported: "+" 20 px across (my choice)
  fixation_line_px: 3,                          // S28 line thickness, my choice
  catch_text_frac: 0.047,                       // S69: catch text height as a share of the answer-screen width (same look as v1.2; D10)
  background: "#ffffff",                        // S27: white (Figure 2B; option canvases are white)

  // ---------------------------------------------------------------- design
  n_catch: 6,                                   // S68: "six catch trials were interspersed"
  // v1.7 (Bria Long, issue #4): the demo example is now stimulus 46 (kitchen, cutting board), one of the 14 rows the
  // original showed but never analyzed (starred in Table S1). It is taken out of the task, and stimulus 72 (egg carton,
  // the v1.5-v1.6 demo) goes back in. 89 main trials are shown (S73 says 90) and all 76 analyzed items are kept.
  // Stimulus 67 (living room, cutting board, also not analyzed) uses the same target picture as 46, so that one
  // picture is seen in the instructions and again in trial 67. 67 is not analyzed. stimuli.js keeps row 46 for the record.
  removed_from_task: [46],
  n_main: 89,                                   // S73: 90 in the original, minus stimulus 46 (v1.7; was 72 in v1.5-v1.6)
  // S78 not reported: target on the left in half the main trials (D13). With 89, each person gets 44 or 45 on
  // the left (chosen at random), so it is half across people.
  // Practice (S75: none in the original). v1.5 (your addition P11; D26): one practice trial with the demo pictures,
  // repeated until it is answered correctly, at most practice_max_tries times per pass through the instructions.
  practice_max_tries: 3,
  demo: {
    stim_id: 46,                                      // saved as stim_id on the practice trial
    scene_circled: "stimuli/demo/scene46_circled.png",  // scene 46 with a red circle drawn around the cutting board
    target: "stimuli/target/46.png",                  // the cutting board from the photo
    lure: "stimuli/lure/46.png",                      // the other cutting board (stimulus 46's own lure)
  },
  breaks: 0,                                    // S76 not reported: none (D13)
  catch_pass_rule: 6,                           // S15 not reported: all 6 correct (D11). Used in analysis, not in the task.

  // ---------------------------------------------------------------- check-in messages (your additions P8 and P9, 4 Nov 2026; not in the original)
  // P8 (D23): after this many trials in a row with no F or J answer, pause and ask whether the person is still there.
  checkin_after_misses: 5,
  // P9 (D24): a trial counts as "rushed" if F or J was pressed at least rush_early_presses times while the + or the
  // photo was on screen (before the two objects appeared), or if the answer came faster than rush_fast_rt_ms.
  // When rush_trials of the last rush_window trials are rushed, pause and ask the person to slow down.
  rush_early_presses: 3,
  rush_fast_rt_ms: 200,
  rush_window: 5,
  rush_trials: 3,
  // Both counters restart after each check-in. Check-ins pause the task until the person clicks Continue,
  // and are logged (checkin_after column in the trial file; counts in the session file). Nobody is excluded for them.

  // ---------------------------------------------------------------- screen and timing checks (session-level; D07, D08)
  refresh_sample_frames: 120,                   // frames sampled to estimate refresh rate (D07)
  min_window_width_px: 800,                     // browser-check minimum window size (D08)
  min_window_height_px: 500,

  // ---------------------------------------------------------------- consent and debrief (v1.4)
  // Consent: the lab's UCSD consent form, copied word for word from the screenshot you sent (4 Nov 2026).
  // v1.5: 150 participants and 10-20 minutes, as you gave them (6 Nov 2026).
  // CHECK BEFORE GOING LIVE: "The expected duration of the study is 10 years" is still the other study's wording.
  consent_html: `
    <p>Timothy Brady, Ph.D., is conducting a research study to find out more about attention, memory and vision. You have been asked to participate because you are a healthy young adult. There will be approximately 150 participants in this study. The expected duration of the study is 10 years, though your participation will last only between 10-20 minutes.</p>
    <p><b>PROCEDURES.</b> If you agree to participate in this study, the following will happen to you: 1. You will be shown displays of letters, words, or pictures, right here in your web browser. 2. You will try to perceive and remember these stimuli, and respond by pressing keys or moving and clicking the mouse in a manner that we will describe to you.</p>
    <p><b>RISKS.</b> You will be required only to continue to interact with your web browser and make responses for a short duration. Thus, no potential risks or discomforts are anticipated except for the possibility that some tasks may be slightly boring. However, there may be risks that are currently unforeseeable.</p>
    <p><b>RIGHTS.</b> You may call the UCSD Human Research Protection Program at 858-657-5100 to ask about your rights as a research subject or to report research-related problems.</p>
    <p><b>BENEFITS.</b> There will be no direct benefit to you from these procedures. However, the investigator may learn more about basic questions pertaining to attention, memory and vision. This knowledge may have benefits to society in fields ranging from improving education to visual design, but these benefits will be indirect.</p>
    <p><b>EXPLANATION.</b> The researcher has explained this study to you and answered your questions. If you have questions about the research or research-related problems, including any adverse events, you may reach Dr. Timothy Brady at timbrady@ucsd.edu or 858-822-4530.</p>
    <p><b>VOLUNTARY NATURE OF PARTICIPATION.</b> Participation in research is entirely voluntary. You may refuse to participate or withdraw at any time without penalty. The alternative to participation is to choose not to participate.</p>
    <p><b>CONFIDENTIALITY.</b> Research records will be kept confidential to the extent allowed by law. As with all research, there is also the possibility of loss of confidentiality. Information from participants such as yourself will be identified by a subject number, which is not associated with your identity, by the researchers, to minimize the potential loss of confidentiality.</p>`,
  consent_accept_text: "By Clicking HERE to start the experiment, you are indicating that you are at least 18 years old, have read this consent form and agree to participate in this research study. Please print a copy of this page for your records.",
  // Debrief: my draft in plain language. Replace it with IRB-approved text if your protocol has one.
  debrief_html: `
    <h2>About this study</h2>
    <p>Thank you for taking part.</p>
    <p>In this study you saw photos of rooms, and then picked which of two objects had been in the photo. Some objects fit their room well, such as a pot in a kitchen. Others did not, such as a pot in a bathroom.</p>
    <p>We want to know whether people identify an object more accurately when it fits the scene, when it clearly does not fit, or in both cases. A study by Su, Qiu and Ding (2025) found that both kinds of objects were identified more accurately than objects that only partly fit. This study repeats their experiment with English-speaking students.</p>
    <p>If you have any questions about this study, please email psuwanamalikmurphy@ucsd.edu.</p>`,
};
