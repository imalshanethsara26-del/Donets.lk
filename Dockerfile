FROM node:18-alpine
WORKDIR /app

# package.json සහ index.js එක එකවර කොපි කිරීම
COPY package.json ./
COPY index.js ./

RUN npm install

EXPOSE 3000
CMD ["node", "index.js"]
