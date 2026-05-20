#!/bin/bash

# =====================================================
# TMUX SESSION
# =====================================================

SESSION="microstructure_gui"

# =====================================================
# ROOT DIRECTORY
# =====================================================

ROOT="$HOME/analysis-tools/dashboard-ec/vol-regime-dashboard/microstructure-engine"

# =====================================================
# CHECK EXISTING SESSION
# =====================================================

tmux has-session -t $SESSION 2>/dev/null

if [ $? == 0 ]; then

    echo "Session already exists."

    tmux attach -t $SESSION

    exit
fi

# =====================================================
# CREATE SESSION
# =====================================================

tmux new-session -d -s $SESSION

# =====================================================
# ROOT
# =====================================================

tmux send-keys -t $SESSION "

cd $ROOT

conda activate base

python scripts/run_app.py

" C-m

# =====================================================
# ATTACH
# =====================================================

tmux attach -t $SESSION