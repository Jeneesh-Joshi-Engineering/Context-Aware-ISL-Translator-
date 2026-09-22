package com.isl.backend.translation;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.isl.backend.gemini.GeminiRequestBuilder;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class BilingualClientTest {
    @Test void structuredProviderResponseIsValidatedInBothDirections() throws Exception {
        var mapper=new ObjectMapper(); var body=new AtomicReference<String>();var key=new AtomicReference<String>();
        var content=new AtomicReference<>("{\"englishText\":\"Please wait here.\",\"hindiText\":\"कृपया यहाँ प्रतीक्षा करें।\"}");
        var transientFailures=new AtomicInteger(); var attempts=new AtomicInteger();
        var server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/model:generateContent", exchange -> {
            attempts.incrementAndGet();
            if (transientFailures.getAndUpdate(n -> Math.max(0,n-1))>0) {
                exchange.sendResponseHeaders(503,-1);exchange.close();return;
            }
            body.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));key.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
            var bytes=mapper.writeValueAsBytes(Map.of("candidates",List.of(Map.of("content",Map.of("parts",List.of(Map.of("text",content.get())))))));
            exchange.getResponseHeaders().set("Content-Type","application/json");exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
        });server.start();
        try {
            var client=new GeminiClient(WebClient.builder(),new GeminiRequestBuilder(),"test-key","http://127.0.0.1:"+server.getAddress().getPort(),"model",3000);
            var result=client.bilingual("Please wait here.","en-IN",true,List.of()).join();
            assertEquals("कृपया यहाँ प्रतीक्षा करें।",result.hindiText()); assertEquals("gemini",result.mode()); assertEquals("test-key",key.get());
            var request=mapper.readTree(body.get()); assertEquals("application/json",request.path("generationConfig").path("responseMimeType").asText());
            assertTrue(request.path("systemInstruction").toString().contains("official"));
            var faithful=client.bilingual("Do not go to platform 3; wait at counter 2.","en-IN",true,List.of()).join();
            assertEquals("Do not go to platform 3; wait at counter 2.",faithful.englishText());
            var hindi=client.bilingual("कृपया यहाँ प्रतीक्षा करें।","hi-IN",true,List.of()).join();
            assertEquals("कृपया यहाँ प्रतीक्षा करें।",hindi.hindiText());
            int before=attempts.get();transientFailures.set(1);
            assertEquals("gemini",client.bilingual("Please wait here.","en-IN",true,List.of()).join().mode());
            assertEquals(before+2,attempts.get());
            content.set("{\"transcript\":\"कृपया यहाँ प्रतीक्षा करें।\"}");
            assertEquals("कृपया यहाँ प्रतीक्षा करें।",client.transcribe(new byte[]{1,2,3},"audio/webm","hi-IN").join());
            var audioRequest=mapper.readTree(body.get());
            assertEquals("audio/webm",audioRequest.path("contents").path(0).path("parts").path(0).path("inlineData").path("mimeType").asText());
            assertEquals("AQID",audioRequest.path("contents").path(0).path("parts").path(0).path("inlineData").path("data").asText());
            content.set("{\"englishText\":\"Please wait here.\",\"hindiText\":\"कृपया यहाँ प्रतीक्षा करें।\"}");
            client.bilingual("Help","en-IN",false,List.of()).join();assertTrue(body.get().contains("ISL gloss"));
            content.set("{\"englishText\":\"Please wait here.\",\"hindiText\":\"\"}");
            assertThrows(java.util.concurrent.CompletionException.class,()->client.bilingual("Help","en-IN",false,List.of()).join());
            content.set("not JSON");assertThrows(java.util.concurrent.CompletionException.class,()->client.bilingual("Help","en-IN",false,List.of()).join());
        } finally {server.stop(0);}
    }
}
