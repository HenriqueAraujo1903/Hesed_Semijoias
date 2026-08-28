# ============================================
# HESED Semijoias API - Multi-stage Dockerfile
# ============================================

# Stage 1: Build
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

# Cache dependencies
COPY pom.xml .
COPY .mvn .mvn
RUN apk add --no-cache maven && \
    mvn dependency:go-offline -B

# Build application
COPY src ./src
RUN mvn package -DskipTests -B && \
    mv target/*.jar app.jar

# Stage 2: Runtime
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S hesed && adduser -S hesed -G hesed

# Create uploads directory
RUN mkdir -p /app/uploads && chown hesed:hesed /app/uploads

# Copy jar from build stage
COPY --from=build /app/app.jar app.jar

# Switch to non-root user
USER hesed

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/products/catalog || exit 1

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar", "--spring.profiles.active=prod"]
