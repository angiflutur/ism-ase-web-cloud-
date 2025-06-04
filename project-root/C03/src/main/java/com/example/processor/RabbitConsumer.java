package com.example.processor;

import com.rabbitmq.client.*;
import jakarta.annotation.PostConstruct;
import jakarta.ejb.Singleton;
import jakarta.ejb.Startup;

import java.nio.charset.StandardCharsets;

@Singleton
@Startup
public class RabbitConsumer {

    private static final String HOST  = "c02-rabbitmq";
    private static final String USER  = "angelica";
    private static final String PASS  = "angelica123";
    private static final String QUEUE = "imageQueue";

    private Connection conn;
    private Channel ch;

    @PostConstruct
    private void init() {
        // start listener thread after bean creation
        new Thread(this::listen, "rabbit-listener").start();
    }

    /*───────────────────────────────────────────────────────────────────────*/

    private void listen() {
        ConnectionFactory f = new ConnectionFactory();
        f.setHost(HOST);
        f.setUsername(USER);
        f.setPassword(PASS);
        f.setAutomaticRecoveryEnabled(true);        // enable automatic connection recovery
        f.setNetworkRecoveryInterval(5000);         // retry every 5 seconds on failure

        while (true) {
            try {
                conn = f.newConnection();            // establish connection
                ch = conn.createChannel();           // open channel

                // declare durable queue (will survive broker restart)
                ch.queueDeclare(QUEUE, true, false, false, null);

                // start consuming messages with manual ack
                ch.basicConsume(QUEUE, false, deliverCallback(), tag -> {});

                System.out.println("[RabbitConsumer] connected - waiting on '" + QUEUE + "'");
                return;  // exit loop on successful connection
            } catch (Exception e) {
                System.err.println("[RabbitConsumer] rabbitmq down, retry in 5 s: " + e);
                try { Thread.sleep(5000); } catch (InterruptedException ignored) {}
                // retry connection after delay
            }
        }
    }

    /*──────────────────────── callback for each received message ─────────────────────*/

    private DeliverCallback deliverCallback() {
        return (tag, msg) -> {
            String json = new String(msg.getBody(), StandardCharsets.UTF_8);
            System.out.println("msg len=" + json.length());

            try {
                PictureProcessor.process(json);  // process image and upload result
                ch.basicAck(msg.getEnvelope().getDeliveryTag(), false);  // acknowledge success
            } catch (Exception ex) {
                System.err.println("pictureProcessor error: " + ex);
                ex.printStackTrace();
                ch.basicReject(msg.getEnvelope().getDeliveryTag(), false); // reject message, do not requeue
            }
        };
    }
}
