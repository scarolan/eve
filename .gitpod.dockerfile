FROM gitpod/workspace-full

# Install Redis
RUN sudo apt -y update && sudo apt -y install redis-server && sudo rm -rf /var/lib/apt/lists/*
