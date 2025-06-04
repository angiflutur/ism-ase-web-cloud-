package com.example.encryption.controller;

import com.example.encryption.config.RabbitConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/encrypt")
public class EncryptionController {

    @Autowired
    private RabbitTemplate rabbit;

    private final ObjectMapper mapper = new ObjectMapper();

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> upload(@RequestParam MultipartFile file,
                                                      @RequestParam String key,
                                                      @RequestParam String operation,
                                                      @RequestParam String mode) {
        try {
            // generate unique id for the message
            String id = UUID.randomUUID().toString(); 

            // prepare message map to send via RabbitMQ
            Map<String, Object> msg = Map.of(
                    "id",         id,
                    "fileName",   file.getOriginalFilename(),
                    "fileBase64", Base64.getEncoder().encodeToString(file.getBytes()),
                    "key",        key,
                    "operation",  operation,
                    "mode",       mode
            );

            // convert map to JSON string
            String json = mapper.writeValueAsString(msg);

            // send JSON message to the configured exchange and routing key
            rabbit.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.ROUTING, json);

            // respond with the generated id
            return ResponseEntity.ok(Map.of("id", id));
        } catch (Exception e) {
            e.printStackTrace();
            // return error message on failure
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/")
    public ResponseEntity<String> home() {
        return ResponseEntity.ok("BACKEND IS RUNNING!");
    }
}
