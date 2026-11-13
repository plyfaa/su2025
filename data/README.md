# Data

## File names

Each session saves three files to DataPipe (+ from there to OSF):

```
su2025_exp1a_main_2026-11-12_5c36tad9ns_trials.csv
su2025_exp1a_main_2026-11-12_5c36tad9ns_session.csv
su2025_exp1a_main_2026-11-12_5c36tad9ns_raw.json
```

| Field | Example | Meaning |
|---|---|---|
| study | `su2025` | this replication |
| experiment | `exp1a` | Su et al. (2025) Experiment 1a |
| sample | `main`, `pilotA`, `test` | from `&sample=` in the link; `main` if the link has none |
| date | `2026-11-12` | session start date, UTC, year-month-day |
| subject | `5c36tad9ns` | random ID made by the task; not linked to identity |
| file | `trials`, `session`, `raw` | one row per trial, one row per session, everything jsPsych logged |

Underscores separate fields and hyphens appear only inside a field, so a name can be split on `_` in R.

If an upload is retried, the copy is saved as `..._trials_retry1.csv`. Keep one file per `subject_id` (see `analysis/`).

## What goes in the repo

This repo is public. All three raw files contain the participant's SONA ID (`sona_id`), which can be traced back to a student in SONA.

1. Download the raw files into `data/raw/`. That folder is ignored by git, as are all `.json` files in `data/`.
2. Write an anonymized copy of each trials and session file into `data/`, with `sona_id` and `user_agent` removed and `-anon` added before `.csv`, e.g. `su2025_exp1a_main_2026-11-12_5c36tad9ns_trials-anon.csv`.
3. Commit only the `-anon` files. The `.gitignore` blocks every other `.csv`.
