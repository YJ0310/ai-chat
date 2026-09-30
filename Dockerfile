FROM node:22-alpine

ARG APP_HOME=/home/node/app
WORKDIR ${APP_HOME}

# Install essential packages
RUN apk add --no-cache tini git dos2unix

# Copy package definition and install production dependencies
COPY package*.json ./
RUN npm ci --no-audit --no-fund --loglevel=error --omit=dev --ignore-scripts && npm cache clean --force

# Copy application source code
COPY . .

# Setup directories and permissions
RUN mkdir -p config data plugins public/scripts/extensions/third-party backups default/scaffold && \
    cp default/config.yaml config/config.yaml || true && \
    ln -sf ./config/config.yaml config.yaml && \
    chown -R node:node ${APP_HOME}

# Build frontend bundle
RUN node ./docker/build-lib.js && \
    chown -R node:node ${APP_HOME}

USER node
ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["tini", "--"]
CMD ["node", "--max-old-space-size=400", "server.js", "--listen", "--whitelist=false", "--basicAuthMode=true"]
