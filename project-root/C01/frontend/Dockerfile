FROM critoma/amd64_u24_noble_ism_security:latest AS node-build

# install curl + nodejs 18 from nodesource
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# working directory
WORKDIR /app

# install dependencies
COPY package.json ./
RUN npm install

# copy source files and public assets
COPY src ./src
COPY public ./public

# build react app (outputs to /app/build)
RUN npm run build

FROM critoma/amd64_u24_noble_ism_security:latest

# install nginx
RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# copy frontend build files to nginx's html directory
COPY --from=node-build /app/build /var/www/html

# optional: copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# expose port 80
EXPOSE 80

# run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
