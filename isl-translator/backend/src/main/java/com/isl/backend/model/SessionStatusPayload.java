package com.isl.backend.model;

public class SessionStatusPayload {
    public boolean signerConnected;
    public boolean officialConnected;
    public SessionStatusPayload() { }
    public SessionStatusPayload(boolean signerConnected, boolean officialConnected) {
        this.signerConnected = signerConnected; this.officialConnected = officialConnected;
    }
}
