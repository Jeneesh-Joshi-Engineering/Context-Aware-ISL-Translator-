package com.isl.backend.logging;

import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class KpiLogger {
    private static final Logger log = LoggerFactory.getLogger(KpiLogger.class);
    public void success(String sessionId, List<String> keywords, long ms) {
        log.info("KPI_GENERATION sessionId={} keywords={} generationTimeMs={} timestamp={}", sessionId, keywords, ms, Instant.now());
    }
    public void error(String sessionId, String detail) {
        log.warn("KPI_ERROR sessionId={} detail={} timestamp={}", sessionId, detail, Instant.now());
    }
}
