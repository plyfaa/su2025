

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
# full.names = TRUE    gives the folder too, like "data/exp1a_v1.6_abc_trials.csv"
trial_files <- list.files(data_folder, pattern = "_trials", full.names = TRUE)

length(trial_files) # how many trial files were found (one per person, AND any retries)



# -----------------------------------------------------------------------------
# STEP 2. Remove people who missed any catch trial
# -----------------------------------------------------------------------------
# Catch trials are a check in the paradigm to determine whether someone was paying attention. 
# Each person has 6 catch trials. The original paper does not report its cutoff.
# My version keeps only people with all 6 trials correct (perhaps this is too restrictive?)



# -----------------------------------------------------------------------------
# STEP 3. Keep only the trials the analysis uses
# -----------------------------------------------------------------------------


# -----------------------------------------------------------------------------
# STEP 4. Remove each person's fast or slow answers. Anything that appears strange... 
# -----------------------------------------------------------------------------


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








