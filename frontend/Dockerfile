FROM node:20
COPY frontend /app
WORKDIR /app
RUN npm install --force

ARG MY_BUILD_ENV=prod
ENV MY_BUILD_ENV=${MY_BUILD_ENV}

RUN if [ "$MY_BUILD_ENV" = "prod" ]; then npm run build; fi

EXPOSE 3000
CMD ["sh", "-c", "if [ \"$MY_BUILD_ENV\" = \"prod\" ]; then npm run start; else npm run dev; fi"]

