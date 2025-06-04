# build stage using custom base image with maven and JDK
FROM critoma/amd64_u24_noble_ism_security:latest AS maven-build

# install maven and JDK 17, clean apt cache
RUN apt-get update && apt-get install -y maven openjdk-17-jdk && rm -rf /var/lib/apt/lists/*

# set JAVA_HOME and update PATH
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH="$JAVA_HOME/bin:$PATH"

WORKDIR /app

# copy only pom.xml first to cache dependencies
COPY pom.xml .

# download all dependencies offline to speed up build
RUN mvn -q dependency:go-offline

# copy source code
COPY src ./src

# build the package, skip tests for faster build
RUN mvn -q clean package -DskipTests


# final runtime image
FROM critoma/amd64_u24_noble_ism_security:latest

# install JRE 17 and netcat, clean apt cache
RUN apt-get update && apt-get install -y openjdk-17-jre netcat-openbsd && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# copy the built jar from build stage
COPY --from=maven-build /app/target/encryption-0.0.1-SNAPSHOT.jar app.jar

# copy entrypoint script and make executable
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# expose app port
EXPOSE 8080

# run entrypoint script
ENTRYPOINT ["./entrypoint.sh"]
