package com.hesed.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadPath + "/");
    }

    /**
     * Garante UTF-8 nas respostas HTTP. Sem o charset explícito, o
     * Content-Type sai como "application/json" puro; com "nosniff" (definido no
     * Nginx) o navegador não infere o charset e emojis/acentos multi-byte
     * chegam quebrados (�) no cliente.
     *
     * Ajustamos os converters JÁ existentes (não substituímos a lista) para
     * anunciar application/json;charset=UTF-8 e texto em UTF-8.
     */
    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        for (HttpMessageConverter<?> c : converters) {
            if (c instanceof MappingJackson2HttpMessageConverter json) {
                json.setDefaultCharset(StandardCharsets.UTF_8);
                json.setSupportedMediaTypes(List.of(
                        new MediaType("application", "json", StandardCharsets.UTF_8),
                        new MediaType("application", "*+json", StandardCharsets.UTF_8)));
            } else if (c instanceof StringHttpMessageConverter str) {
                str.setDefaultCharset(StandardCharsets.UTF_8);
            }
        }
    }
}
