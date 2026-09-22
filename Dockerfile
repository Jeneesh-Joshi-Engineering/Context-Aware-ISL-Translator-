FROM node:24-bookworm-slim AS assets
WORKDIR /build
COPY package*.json ./
RUN npm ci --omit=dev
COPY scripts/prepare-assets.mjs scripts/prepare-assets.mjs
COPY isl-translator/frontend isl-translator/frontend
COPY isl-translator/model-training/saved_model/words_v5/demo-samples.json isl-translator/model-training/saved_model/words_v5/demo-samples.json
RUN npm run assets

FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build/isl-translator/backend
COPY isl-translator/backend/pom.xml ./
COPY isl-translator/backend/src ./src
COPY --from=assets /build/isl-translator/frontend /build/isl-translator/frontend
RUN mvn -B package

FROM eclipse-temurin:25-jre
WORKDIR /app
RUN mkdir -p /app/data && chown -R 10001:10001 /app
COPY --from=build /build/isl-translator/backend/target/isl-contextual-backend-0.0.1-SNAPSHOT.jar /app/app.jar
USER 10001:10001
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
