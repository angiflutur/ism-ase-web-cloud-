package com.example.encryption.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration 
public class CorsConfig {

    @Bean 
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                // enable cors for api paths from localhost ports
                registry.addMapping("/api/**")
                        .allowedOrigins("http://localhost", "http://localhost:80", "http://localhost:3000")
                        .allowedMethods("*")      // allow all http methods (get, post, etc)
                        .allowedHeaders("*")      // allow all headers
                        .allowCredentials(false); // do not allow cookies/auth headers
            }
        };
    }
}
