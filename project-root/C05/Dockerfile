# ────────────────────────────────────────────────────────────────
# stage 1 – install node 18 on the critoma base image
# ────────────────────────────────────────────────────────────────
FROM critoma/amd64_u24_noble_ism_security:latest AS node-build

RUN apt-get update \
 && apt-get install -y curl \
 && rm -rf /var/lib/apt/lists/*

# install node 18 from official nodesource setup script
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
 && apt-get install -y nodejs \
 && node -v && npm -v

WORKDIR /app

# install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

# copy source code
COPY src ./src

# ────────────────────────────────────────────────────────────────
# stage 2 – run app, still based on critoma for consistency
# ────────────────────────────────────────────────────────────────
FROM critoma/amd64_u24_noble_ism_security:latest

# copy node binary and modules from previous stage, avoid reinstall
COPY --from=node-build /usr/bin/node        /usr/bin/
COPY --from=node-build /usr/lib/node_modules /usr/lib/node_modules
COPY --from=node-build /usr/bin/npm          /usr/bin/

ENV NODE_PATH=/usr/lib/node_modules
ENV PATH="$PATH:/usr/lib/node_modules/.bin"

WORKDIR /app
COPY --from=node-build /app ./

EXPOSE 3000
CMD ["node", "src/server.js"]
