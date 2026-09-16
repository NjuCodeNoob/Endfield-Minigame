FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
COPY backend ./backend
COPY dist ./dist
ENV HOST=0.0.0.0 PORT=5173 RACE_DATA_FILE=/data/store.json
RUN mkdir /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 5173
CMD ["node", "server.mjs"]
