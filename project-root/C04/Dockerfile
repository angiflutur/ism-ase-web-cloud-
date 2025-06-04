FROM critoma/amd64_u24_noble_ism_security:latest

# update and install build tools and openmpi libraries
RUN apt-get update \
 && apt-get install -y build-essential openmpi-bin libopenmpi-dev libssl-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# copy source code
COPY main.c .

# compile mpi program with openmp and openssl
RUN mpicc -fopenmp -o /usr/local/bin/mpi_openmp main.c -lcrypto

# keep container running
ENTRYPOINT ["sleep", "infinity"]
