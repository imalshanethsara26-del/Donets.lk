FROM node:18-alpine

# git සහ අවශ්‍ය ටූල්ස් ඉන්ස්ටෝල් කිරීම සඳහා
RUN apk add --no-cache git

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
