# syntax=docker/dockerfile:1

###############################################################################
# ⬤ stage a – build mpi_openmp from c04/main.c                               #
###############################################################################
FROM critoma/amd64_u24_noble_ism_security:latest AS mpi-build

# install build tools and openmpi
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential openmpi-bin libopenmpi-dev libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY ./C04/main.c .
# compile mpi program with openmp and openssl
RUN mpicc -fopenmp -o mpi_openmp main.c -lcrypto



###############################################################################
# ⬤ stage b – final image with tomee, war and mpi binary                      #
###############################################################################
FROM critoma/amd64_u24_noble_ism_security:latest

# set environment variables for runtime and openmpi root permission
ENV DEBIAN_FRONTEND=noninteractive \
    OMPI_ALLOW_RUN_AS_ROOT=1 \
    OMPI_ALLOW_RUN_AS_ROOT_CONFIRM=1

# install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        openjdk-17-jdk maven \
        openmpi-bin libopenmpi-dev \
        wget unzip && \
    rm -rf /var/lib/apt/lists/*

# download and extract tomee
ARG TOMEE_VERSION=10.0.1
RUN mkdir -p /tomee && \
    wget -q https://downloads.apache.org/tomee/tomee-${TOMEE_VERSION}/apache-tomee-${TOMEE_VERSION}-webprofile.tar.gz -O - \
    | tar -xz --strip-components=1 -C /tomee

ENV CATALINA_HOME=/tomee
ENV PATH="$CATALINA_HOME/bin:$PATH"

# copy mpi binary from build stage and set execute permission
COPY --from=mpi-build /build/mpi_openmp /usr/local/bin/mpi_openmp
RUN chmod 755 /usr/local/bin/mpi_openmp

# build and deploy java app (c03-processor)
WORKDIR /src

# copy pom.xml first for better cache
COPY ./C03/pom.xml .
RUN mvn -q dependency:go-offline -B

# copy sources and build war
COPY ./C03/src ./src
RUN mvn -q package -DskipTests -B

# deploy war to tomee
RUN cp target/c03-processor-*.war "$CATALINA_HOME/webapps/"

# expose port and start tomee
EXPOSE 8080
CMD ["catalina.sh","run"]
