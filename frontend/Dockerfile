# Context for running this is in the parent directory

FROM node:20
COPY app /frontend-build
WORKDIR /frontend-build
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
