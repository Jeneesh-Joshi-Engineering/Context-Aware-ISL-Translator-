package com.isl.backend.translation;

import com.isl.backend.model.TranslatedMessagePayload;

public record BilingualText(String englishText, String hindiText, String mode) {
    public TranslatedMessagePayload message(String role) {
        var result = new TranslatedMessagePayload(role, englishText, hindiText);
        result.translationMode = mode;
        return result;
    }
}
