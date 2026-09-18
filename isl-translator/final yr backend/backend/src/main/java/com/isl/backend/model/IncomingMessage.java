package com.isl.backend.model;

import java.util.List;
public class IncomingMessage {
    public MessageType type;
    public String sessionId;
    public String role;
    public String keyword;
    public List<String> keywords;
    public Double confidence;
    public String timestamp;
    public String transcribedText;
}
