package com.isl.backend.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import jakarta.servlet.http.Cookie;
import static org.junit.jupiter.api.Assertions.*;

class DeploymentAccessFilterTest {
    private final String code = "test-only-strong-invitation-123456";
    private final DeploymentAccessFilter filter = new DeploymentAccessFilter(code);
    @Test void protectsApiAndKeepsCounterReturnPath() throws Exception {
        var response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/api/counters"), response, new MockFilterChain());
        assertEquals(401, response.getStatus());
        var request = new MockHttpServletRequest("GET", "/index.html"); request.setQueryString("counter=CTR-ABC");
        response = new MockHttpServletResponse(); filter.doFilter(request, response, new MockFilterChain());
        assertEquals("/access.html?next=%2Findex.html%3Fcounter%3DCTR-ABC", response.getRedirectedUrl());
    }
    @Test void correctCodeIssuesSecureCookieWhichAuthenticatesWebSocket() throws Exception {
        var login = new MockHttpServletRequest("POST", "/api/access"); login.setSecure(true); login.addHeader("X-ISL-Access-Code", code);
        var response = new MockHttpServletResponse(); filter.doFilter(login, response, new MockFilterChain());
        assertEquals(204, response.getStatus()); String cookie = response.getHeader("Set-Cookie");
        assertTrue(cookie.contains("HttpOnly")); assertTrue(cookie.contains("Secure")); assertTrue(cookie.contains("SameSite=Lax"));
        var socket = new MockHttpServletRequest("GET", "/ws/websocket");
        socket.setCookies(new Cookie("isl_access", cookie.split(";", 2)[0].substring("isl_access=".length())));
        var chain = new MockFilterChain(); filter.doFilter(socket, new MockHttpServletResponse(), chain);
        assertNotNull(chain.getRequest());
        socket = new MockHttpServletRequest("GET", "/ws/websocket"); socket.setCookies(new Cookie("isl_access", "9999999999.forged"));
        response = new MockHttpServletResponse(); filter.doFilter(socket, response, new MockFilterChain()); assertEquals(401, response.getStatus());
    }
    @Test void rejectsWrongCodeAndAllowsHealthAndLocalDevelopment() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/access"); request.addHeader("X-ISL-Access-Code", "wrong");
        var response = new MockHttpServletResponse(); filter.doFilter(request, response, new MockFilterChain()); assertEquals(401, response.getStatus());
        var chain = new MockFilterChain(); filter.doFilter(new MockHttpServletRequest("GET", "/api/health"), new MockHttpServletResponse(), chain); assertNotNull(chain.getRequest());
        chain = new MockFilterChain(); new DeploymentAccessFilter("").doFilter(new MockHttpServletRequest("GET", "/api/counters"), new MockHttpServletResponse(), chain); assertNotNull(chain.getRequest());
        assertThrows(IllegalArgumentException.class, () -> new DeploymentAccessFilter("short"));
    }
}
