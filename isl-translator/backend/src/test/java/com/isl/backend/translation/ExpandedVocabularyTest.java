package com.isl.backend.translation;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ExpandedVocabularyTest {
    private final TemplateFallbackAgent fallback = new TemplateFallbackAgent();

    @Test void expandedWordsHaveBothLanguages() {
        for (String word : new String[]{"Counter", "Entrance", "Exit", "Help", "Money", "Police", "Receipt", "Security", "Ticket", "Train", "When", "Where"}) {
            var result = fallback.bilingual(word, "en", false);
            assertFalse(result.englishText().isBlank(), word);
            assertTrue(result.hindiText().matches("(?s).*[\\u0900-\\u097F].*"), word);
            assertEquals("offline-phrase", result.mode());
        }
    }

    @Test void lettersRemainLiteralAndQuestionsDoNotInventContext() {
        for (char letter = 'A'; letter <= 'Z'; letter++) {
            var result = fallback.bilingual(String.valueOf(letter), "en", false);
            assertEquals("Letter " + letter + ".", result.englishText());
            assertEquals("अक्षर " + letter + "।", result.hindiText());
        }
        assertEquals("When?", fallback.bilingual("When", "en", false).englishText());
        assertEquals("Where?", fallback.bilingual("Where", "en", false).englishText());
    }
}
