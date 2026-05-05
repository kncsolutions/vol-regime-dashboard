#!/bin/bash

SESSION="vol_dashboard"

# Kill existing session if it exists
tmux has-session -t $SESSION 2>/dev/null
if [ $? -eq 0 ]; then
    echo "⚠️ Existing session found. Killing it..."
    tmux kill-session -t $SESSION
fi

echo "🚀 Starting tmux session: $SESSION"

# Create new detached session
tmux new-session -d -s $SESSION

# ---- Pane 1: Frontend ----
tmux rename-window -t $SESSION "services"
tmux send-keys -t $SESSION "
cd frontend &&
echo '🌐 Frontend running on http://localhost:8000' &&
python -m http.server 8000
" C-m

# ---- Pane 2: WS Server ----
tmux split-window -h -t $SESSION
tmux send-keys -t $SESSION "
cd backend &&
echo '🔌 WebSocket server on port 8001' &&
uvicorn ws_server:app --port 8001
" C-m

# ---- Pane 3: Backend App ----
tmux split-window -v -t $SESSION:0.1
tmux send-keys -t $SESSION "
cd backend &&
echo '⚙️ Backend app starting...' &&
python app.py
" C-m

# Optional: evenly size panes
tmux select-layout -t $SESSION tiled

# Attach to session
tmux attach -t $SESSION