FROM critoma/amd64_u24_noble_ism_security:latest

RUN apt-get update && apt-get install -y rabbitmq-server && rm -rf /var/lib/apt/lists/*

# enable important rabbitmq plugins offline
RUN rabbitmq-plugins enable --offline rabbitmq_management rabbitmq_amqp1_0

# set default user and password
ENV RABBITMQ_DEFAULT_USER=angelica \
    RABBITMQ_DEFAULT_PASS=angelica123

# expose rabbitmq ports: 5672 for AMQP, 15672 for management UI
EXPOSE 5672 15672

CMD ["rabbitmq-server"]
