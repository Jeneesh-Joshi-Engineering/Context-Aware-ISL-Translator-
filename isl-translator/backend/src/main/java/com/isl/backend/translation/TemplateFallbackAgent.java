package com.isl.backend.translation;

import org.springframework.stereotype.Component;

@Component
public class TemplateFallbackAgent {
    public String sentenceFor(String keyword) {
        String clean = keyword == null ? "" : keyword.trim().replace('_', ' ');
        if (clean.isBlank()) return "I need assistance.";
        return switch (clean.toLowerCase()) {
            case "help" -> "I need help, please.";
            case "train" -> "I need information about the train.";
            case "ticket" -> "I need help with my ticket.";
            case "no gesture" -> "I would like to communicate with the staff.";
            default -> "I need assistance with " + clean + ".";
        };
    }
}
