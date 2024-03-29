FROM node:18.10.0-alpine

WORKDIR /usr/app

COPY package.json \
     yarn.lock \
     ./

RUN yarn --frozen-lockfile

COPY src/* src/

EXPOSE 3100
CMD ["node", "src/index.js"]
