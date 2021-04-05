FROM node:15.13.0-alpine
WORKDIR /src
COPY package*.json ./
RUN npm install
# If you are building your code for production
# RUN npm ci --only=production
COPY . .
EXPOSE 80
CMD [ "node", "index.js" ]
