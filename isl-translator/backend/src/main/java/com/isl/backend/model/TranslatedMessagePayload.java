package com.isl.backend.model;

public class TranslatedMessagePayload {
    public String originRole;
    public String englishText;
    public String hindiText;
    public String translationMode;
    public TranslatedMessagePayload() { }
    public TranslatedMessagePayload(String originRole, String englishText, String hindiText) {
        this.originRole = originRole; this.englishText = englishText; this.hindiText = hindiText;
    }
}
