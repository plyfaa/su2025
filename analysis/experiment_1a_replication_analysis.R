

# =============================================================================
# Su, Qiu & Ding (2025), Experiment 1a: replication analysis 
# =============================================================================


# -----------------------------------------------------------------------------
# STEP 0. Load  packages
# -----------------------------------------------------------------------------

# install.packages(c("dplyr", "ggplot2", "lme4"))

library(dplyr)    # functions for picking rows and summarizing tables
library(ggplot2)  # functions for making plots
library(lme4)     # fits the statistical model that will be used 



# -----------------------------------------------------------------------------
# STEP 1. Read every participant's trial file into one table
# -----------------------------------------------------------------------------

data_folder <- "data" # the name of the folder holding the CSV files
# <- means "store this in". Read it as "data_folder gets 'data'" 

# list.files() lists the files inside a folder.
# pattern = "_trials"  keeps only file names that contain "_trials"
# full.names = TRUE    gives the folder too, like "data/su2025_exp1a_v1.7_main_2026-11-12_abc_trials-anon.csv"
# (v1.7 names: study_experiment_version_sample_date_subject; older files are named "exp1a_v1.6_abc_trials.csv")
trial_files <- list.files(data_folder, pattern = "_trials", full.names = TRUE)

length(trial_files) # how many trial files were found (one per person, AND any retries)

# DECIDED (Bria, issue #5, item 4): a retried upload saves the same session twice ("..._trials_retry1.csv"),
# and the pattern above picks up both. After bind_rows, keep one copy per subject_id, for example
# distinct(subject_id, trial_number, .keep_all = TRUE).
# DECIDED (writeup step 1): keep only real sessions, sample == "main" (pilots and tests are tagged in v1.7).



# -----------------------------------------------------------------------------
# STEP 2. Remove people who missed any catch trial
# -----------------------------------------------------------------------------
# Catch trials are a check in the paradigm to determine whether someone was paying attention. 
# Each person has 6 catch trials. The original paper does not report its cutoff.
# My version keeps only people with all 6 trials correct (perhaps this is too restrictive?)
# DECIDED (Bria, issue #5, item 3; writeup step 3): all 6 correct. The rule is now in the writeup too.



# -----------------------------------------------------------------------------
# STEP 3. Keep only the trials the analysis uses
# -----------------------------------------------------------------------------
# DECIDED (Bria, issue #5; writeup step 4): main trials with analyzed_stimulus == 1 only, which is 76 items.
# (v1.7 keeps all 76 because the demo is now stimulus 46, which was never analyzed.)
# DECIDED (Bria, issue #5, item 1; writeup step 5): timeouts (timed_out == 1, accuracy is NA) are EXCLUDED,
# not counted as wrong. Remove them on purpose here and count them, because glmer drops NA rows silently.


# -----------------------------------------------------------------------------
# STEP 4. Remove each person's fast or slow answers. Anything that appears strange... 
# -----------------------------------------------------------------------------
# DECIDED (Bria, issue #5, item 2; writeup step 6): PER PARTICIPANT. Drop trials whose rt_ms is more than
# 2 SD above or below that person's own mean, using the trials left after STEP 3.


# -----------------------------------------------------------------------------
# STEP 5. Look at the data visually and plot before testing anything. 
# -----------------------------------------------------------------------------


# -----------------------------------------------------------------------------
# STEP 6. Make the linear component and the quadratic component
# -----------------------------------------------------------------------------

# The paper uses "a second-order polynomial expansion of scene-object congruency"


# -----------------------------------------------------------------------------
# STEP 8. Our main test!

# A linear model versus a quadratic model...
# -----------------------------------------------------------------------------

# The outcome (accuracy) is 1 or 0. I will use LOGISTIC regression. 
# This predicts the chance of a 1 (which is a correct answer).


# -----------------------------------------------------------------------------
# STEP 9. The numbers for each component
# -----------------------------------------------------------------------------


# -----------------------------------------------------------------------------
# STEP 10. How much data went into the model
# -----------------------------------------------------------------------------

# participants (the paper had 69 participants)
# trials








