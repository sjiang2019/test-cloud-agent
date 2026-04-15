FROM ubuntu:24.04

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
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for running commands
RUN useradd -m -s /bin/bash sandbox
USER sandbox
WORKDIR /home/sandbox

CMD ["sleep", "infinity"]
