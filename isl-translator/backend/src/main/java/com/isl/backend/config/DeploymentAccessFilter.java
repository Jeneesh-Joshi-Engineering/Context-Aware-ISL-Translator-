package com.isl.backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Optional shared invitation gate for a faculty prototype; not staff identity management. */
@Component
public class DeploymentAccessFilter extends OncePerRequestFilter {
    private final String code;
    public DeploymentAccessFilter(@Value("${DEPLOYMENT_ACCESS_CODE:}") String code) {
        if (!code.isEmpty() && code.length() < 24) throw new IllegalArgumentException("DEPLOYMENT_ACCESS_CODE must contain at least 24 characters");
        this.code = code;
    }
    private String signature(String expiry) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(code.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(expiry.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    private boolean equal(String a, String b) { return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8)); }
    private boolean authenticated(HttpServletRequest request) {
        if (request.getCookies() == null) return false;
        for (var cookie : request.getCookies()) if (cookie.getName().equals("isl_access")) {
            var parts = cookie.getValue().split("\\.");
            try { if (parts.length == 2 && Long.parseLong(parts[0]) > System.currentTimeMillis() / 1000 && equal(parts[1], signature(parts[0]))) return true; }
            catch (NumberFormatException ignored) { }
        }
        return false;
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws IOException, ServletException {
        String path = request.getRequestURI();
        if (code.isEmpty() || path.equals("/api/health") || path.equals("/access.html") || path.equals("/js/access.js")) { chain.doFilter(request, response); return; }
        response.setHeader("Cache-Control", "no-store");
        if (path.equals("/api/access") && request.getMethod().equals("POST")) {
            // Custom header prevents cross-site HTML forms from authenticating a browser.
            String supplied = request.getHeader("X-ISL-Access-Code");
            if (supplied == null || supplied.length() > 256 || !equal(code, supplied)) { response.setStatus(401); return; }
            String expiry = Long.toString(System.currentTimeMillis() / 1000 + 28800);
            response.addHeader("Set-Cookie", "isl_access=" + expiry + "." + signature(expiry) + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800" + (request.isSecure() ? "; Secure" : ""));
            response.setStatus(204); return;
        }
        if (authenticated(request)) { chain.doFilter(request, response); return; }
        if (request.getMethod().equals("GET") && (path.equals("/") || path.endsWith(".html"))) {
            String next = path + (request.getQueryString() == null ? "" : "?" + request.getQueryString());
            response.sendRedirect("/access.html?next=" + java.net.URLEncoder.encode(next, StandardCharsets.UTF_8));
        } else { response.setStatus(401); response.setContentType("application/json"); response.getWriter().write("{\"error\":\"Prototype access code required\"}"); }
    }
}
