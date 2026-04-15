FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    wget \
    git \
    python3 \
    python3-pip \
    nodejs \
    npm \
    build-essential \
    jq \
    iproute2 \
    ca-certificates \
    software-properties-common \
    # VNC / display stack
    xvfb \
    x11vnc \
    fluxbox \
    novnc \
    python3-websockify \
    python3-numpy \
    # Fonts for the browser
    fonts-liberation \
    fonts-noto-color-emoji \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install Firefox from Mozilla PPA (snap doesn't work in containers)
RUN add-apt-repository -y ppa:mozillateam/ppa \
    && printf 'Package: *\nPin: release o=LP-PPA-mozillateam\nPin-Priority: 1001\n' \
       > /etc/apt/preferences.d/mozilla-firefox \
    && apt-get update \
    && apt-get install -y --no-install-recommends firefox \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for running commands
RUN useradd -m -s /bin/bash sandbox
COPY --chown=sandbox:sandbox start-vnc.sh /home/sandbox/start-vnc.sh
RUN chmod +x /home/sandbox/start-vnc.sh

USER sandbox
WORKDIR /home/sandbox

# Configure git to use GITHUB_TOKEN for https auth
RUN git config --global credential.helper '!f() { echo "username=x-access-token"; echo "password=$GITHUB_TOKEN"; }; f'

# Expose noVNC websockify port
EXPOSE 6080

CMD ["sleep", "infinity"]
