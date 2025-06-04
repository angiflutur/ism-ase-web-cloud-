package com.example.processor;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

public class RabbitProducer {

    private static final String HOST = "c02-rabbitmq";
    private static final String USER = "angelica";
    private static final String PASS = "angelica123";
    private static final String QUEUE = "imageQueue";

    public static void sendMessage(String message) throws Exception {
        // create connection factory and set credentials
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost(HOST);
        factory.setUsername(USER);
        factory.setPassword(PASS);

        // open connection and channel with try-with-resources
        try (Connection connection = factory.newConnection();
             Channel channel = connection.createChannel()) {

            // declare durable queue
            channel.queueDeclare(QUEUE, true, false, false, null);

            // publish message to the queue
            channel.basicPublish("", QUEUE, null, message.getBytes("UTF-8"));

            System.out.println("[RabbitProducer] sent message: " + message);
        }
    }
}
