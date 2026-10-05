# One image, three processes. The SAME image runs as:
#   api        ->  node src/server.js                (default CMD)
#   worker     ->  node src/jobs/billGeneration.job.js
#   scheduler  ->  node src/jobs/scheduler.js        (one-shot, per deploy)
#   migrate    ->  node src/models/migrate.js        (one-shot, per deploy)
# Using one image guarantees all processes run identical code.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
