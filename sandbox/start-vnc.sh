#!/bin/bash
# Start the VNC display stack: Xvfb -> x11vnc -> websockify
# Called once after the sandbox container starts.

set -e

# Virtual framebuffer
Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +render -noreset &>/dev/null &
sleep 1

export DISPLAY=:99

# Lightweight window manager
fluxbox &>/dev/null &
sleep 0.5

# VNC server (no password, shared so multiple viewers can connect)
x11vnc -display :99 -forever -nopw -shared -rfbport 5900 -quiet &>/dev/null &
sleep 0.5

# Websockify: bridges WebSocket (6080) to VNC (5900) and serves noVNC web client
websockify --web /usr/share/novnc 0.0.0.0:6080 localhost:5900 &>/dev/null &

# Launch Firefox
firefox --no-remote --new-instance about:blank &>/dev/null &

echo "VNC stack started on :6080"
