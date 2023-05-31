FROM gitpod/workspace-full

# Install Redis
RUN sudo install-packages redis-server
