#!/bin/sh

echo "Waiting for rabbitmq at $SPRING_RABBITMQ_HOST:5672 ..."

while ! nc -z "$SPRING_RABBITMQ_HOST" 5672; do
  echo "Rabbitmq not available yet, waiting 5 seconds..."
  sleep 5
done

echo "Rabbitmq is available! starting backend..."

exec "$@"  # run command passed as arguments and replace shell process

echo "Waiting for mysql..."  # this will not run because exec above replaces the process
until nc -z mysql 3306; do
  sleep 5
done

echo "Waiting for mongodb..."
until nc -z mongo 27017; do
  sleep 5
done

echo "Waiting for c05 (node.js) service..."
until nc -z c05 3000; do
  sleep 5
done

echo "All services are up! starting spring boot..."
exec java -jar app.jar
