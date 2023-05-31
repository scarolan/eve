FROM gitpod/workspace-full
USER root
# Install Redis
RUN install-packages redis-server
