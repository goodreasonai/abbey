FROM node:20

WORKDIR /frontend-build

# Copy only package files first for better caching
COPY frontend/package*.json ./
RUN npm ci --force

# Now copy the rest of the code
COPY frontend .

EXPOSE 3000
CMD ["npm", "run", "dev"]
