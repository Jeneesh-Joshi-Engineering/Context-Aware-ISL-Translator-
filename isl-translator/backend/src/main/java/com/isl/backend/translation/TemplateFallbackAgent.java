package com.isl.backend.translation;

import org.springframework.stereotype.Component;

@Component
public class TemplateFallbackAgent {
    private static final String[][] PHRASES = {
        {"Please go to platform three.", "कृपया प्लेटफ़ॉर्म तीन पर जाएँ।"},
        {"Please wait here.", "कृपया यहाँ प्रतीक्षा करें।"},
        {"Please show me your ticket.", "कृपया मुझे अपना टिकट दिखाएँ।"},
        {"How can I help you?", "मैं आपकी कैसे सहायता कर सकता हूँ?"},
        {"The ticket counter is on your left.", "टिकट काउंटर आपकी बाईं ओर है।"},
        {"The train arrives soon.", "ट्रेन जल्द ही आएगी।"},
        {"Thank you.", "धन्यवाद।"}
    };
    private String normalized(String text) { return text.toLowerCase(java.util.Locale.ROOT).replaceAll("[.!?।]", "").replaceAll("\\s+", " ").trim(); }
    public BilingualText bilingual(String source, String language, boolean official) {
        if (!official) {
            String hi = switch (source.trim().toLowerCase(java.util.Locale.ROOT)) {
                case "help" -> "कृपया मेरी मदद करें।";
                case "ticket" -> "मुझे अपने टिकट के संबंध में सहायता चाहिए।";
                case "train" -> "मुझे ट्रेन के बारे में जानकारी चाहिए।";
                default -> null;
            };
            if (hi != null) return new BilingualText(sentenceFor(source), hi, "offline-phrase");
        } else {
            for (var pair : PHRASES) if (normalized(source).equals(normalized(pair[0])) || normalized(source).equals(normalized(pair[1])))
                return new BilingualText(pair[0], pair[1], "offline-phrase");
        }
        // Preserve the real source, never masquerade a placeholder as a translation.
        boolean hindi = source.matches("(?s).*[\\u0900-\\u097F].*");
        return new BilingualText(hindi ? "" : source, hindi ? source : "", "unavailable");
    }
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
