
# =============================================================================
# Su, Qiu & Ding (2025), Experiment 1a: replication analysis 

# Date modified: Tuesday, November 17, 2026 
# Written by Plyfaa Suwanamalik-Murphy & assisted with Claude Opus 5.5 
# =============================================================================

# ----------------------------------------------------------------------------- #
# STEP 0. Load  packages
# ----------------------------------------------------------------------------- #

install.packages(c("dplyr", "ggplot2", "lme4"))

library(dplyr) # functions for picking rows and summarizing tables
library(ggplot2) # functions for making plots
library(lme4) # fits the statistical model that will be used 

# ------------- Read every trial file into one table ------------- #

data_folder <- "~/Desktop/su2025/data/raw" # location of my CSV files are
files <- list.files(data_folder, pattern = "_trials.csv", full.names = TRUE) # one file per session is saved 

read_one_file <- function(f) {
  d <- read.csv(f) # load the file
  d$batch <- ifelse("pause_before_ms" %in% names(d), "second", "first")  # only the new task (break screen after 2.5 s is missed) has this column
  d$sona_id <- as.character(d$sona_id) # IDs as text so they can all be combined! 
  d[, c("subject_id", "sona_id", "batch", "sample", "trial_number", "trial_kind", "stim_id", 
        "congruency", "analyzed_stimulus", "timed_out", "accuracy", "rt_ms")]
  }

trials <- bind_rows(lapply(files, read_one_file)) # read every file and combine them all into one table

# ------------- Keep only the participants who passed the catch trials ------------- #

passed <- trials %>%
  filter(trial_kind == "catch") %>% # catch trials only
  group_by(subject_id) %>% # one row per person
  summarise(n_right = sum(accuracy == 1, na.rm = TRUE)) %>% # count correct catch answers
  filter(n_right == 6) # keep only perfect scores

# ------------- Keep only the trials the analysis uses ------------- # 

main <- trials %>%
  filter(subject_id %in% passed$subject_id, # people who passed
         trial_kind == "main", # no catch trials 
         analyzed_stimulus == 1, # the 76 objects the paper analyzed
         timed_out == 0) %>% # answered within the set 2.5 seconds
  group_by(subject_id) %>%  # each person separately
  filter(abs(rt_ms - mean(rt_ms)) <= 2 * sd(rt_ms)) %>% # drop RTs > 2 SD from their own mean
  ungroup()

main %>% group_by(batch) %>% summarise(people = n_distinct(subject_id), trials = n()) # what data is left??

# Mean reaction time for first and second batch 
rt <- summarise(group_by(main, batch), mean_rt = mean(rt_ms) / 1000) # mean RT in seconds

# Attempt 1 
ggplot(data = main,
       mapping = aes(x = batch, y = rt_ms / 1000)) +
  stat_summary(fun = "mean",
               geom = "bar") +
  labs(x = "Batch", y = "Mean reaction time (in seconds)") 

# Attempt 2 
ggplot(data = main,
       mapping = aes(x = batch, y = rt_ms / 1000, fill = batch)) +
  stat_summary(fun = "mean",geom = "bar") +
  labs(x = "Batch", y = "Mean reaction time (in seconds)") +
  theme_classic() + theme(legend.position = "none")

# -----------------------------------------------------------------------------
# Look at the data visually and plot before testing anything. 
# -----------------------------------------------------------------------------


# -----------------------------------------------------------------------------
# The paper uses "a second-order polynomial expansion of scene-object congruency"


# -----------------------------------------------------------------------------
# Our main test!

# A linear model versus a quadratic model...
# -----------------------------------------------------------------------------

# The outcome (accuracy) is 1 or 0. I will use LOGISTIC regression. 
# This predicts the chance of a 1 (which is a correct answer).


# -----------------------------------------------------------------------------
# The numbers for each component
# -----------------------------------------------------------------------------


# -----------------------------------------------------------------------------
# How much data went into the model
# -----------------------------------------------------------------------------



