FROM node:18-alpine
WORKDIR /app

# සියලුම ෆයිල්ස් එකවර /app ෆෝල්ඩර් එකට කොපි කිරීම
COPY . /app/

RUN npm install

EXPOSE 3000
CMD ["node", "index.js"]
