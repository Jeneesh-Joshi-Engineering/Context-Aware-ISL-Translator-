package com.isl.backend.ws;

import com.isl.backend.session.SessionService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class SessionDisconnectListener {
    private final SessionService sessions; private final SessionSocketController socket;
    public SessionDisconnectListener(SessionService sessions, SessionSocketController socket) { this.sessions = sessions; this.socket = socket; }
    @EventListener public void disconnected(SessionDisconnectEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        SessionService.ClientPresence presence = sessions.forgetClient(headers.getSessionId());
        if (presence != null) { if (!sessions.hasClient(presence.sessionId(), presence.role())) sessions.left(presence.sessionId(), presence.role()); socket.broadcastStatus(presence.sessionId()); }
    }
}
