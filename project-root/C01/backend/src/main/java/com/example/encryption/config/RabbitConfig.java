package com.example.encryption.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitConfig {
  public static final String EXCHANGE = "imageExchange";
  public static final String ROUTING = "image.key";
  public static final String QUEUE = "imageQueue";

  @Bean TopicExchange exchange() { return new TopicExchange(EXCHANGE); }

  @Bean Queue queue() { return new Queue(QUEUE); }

  @Bean
  Binding binding(Queue q, TopicExchange ex) {
    // bind queue to exchange using routing key
    return BindingBuilder.bind(q).to(ex).with(ROUTING);
  }

  @Bean
  RabbitTemplate template(ConnectionFactory cf) {
    // template used to send/receive messages
    return new RabbitTemplate(cf);
  }
}
