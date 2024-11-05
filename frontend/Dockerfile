# Context for running this is in the parent directory

FROM node:20
COPY frontend /app
WORKDIR /app
RUN npm install
EXPOSE 3000
CMD ["npm", "run", "dev"]
