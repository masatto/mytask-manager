package com.masatto.mytask.common;

import java.io.IOException;
import java.net.URI;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 同じ PC のブラウザで開いた「別のサイト」から Orbit を操作されないようにする（ログイン機能がないため）。
 *
 * <ol>
 * <li>宛先（Host）が 127.0.0.1 / localhost 以外なら拒否する。DNS リバインディング（攻撃者のドメインを 127.0.0.1 に
 * 向けて同じオリジンを装う手口）で、データを読まれたり変えられたりするのを防ぐ</li>
 * <li>更新系（GET 以外）で、別のサイトから送られたもの（Origin・Sec-Fetch-Site で判定）は拒否する</li>
 * <li>POST は JSON 以外を受け付けない。ブラウザの事前確認（CORS のプリフライト）なしで送れる「単純なリクエスト」
 * （text/plain など）を締め出す。PUT・PATCH・DELETE は常に事前確認が必要なので、ブラウザ側で止まる</li>
 * </ol>
 *
 * curl など、ブラウザ以外から自分の PC で送るリクエストは Origin を付けないので、これまでどおり使える。
 */
@Component
public class LocalOnlyRequestFilter extends OncePerRequestFilter {

    private static final Set<String> LOCAL_HOSTS = Set.of("127.0.0.1", "localhost", "[::1]");
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    private static final Set<String> ALLOWED_FETCH_SITES = Set.of("same-origin", "none");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // getServerName() は Host ヘッダーのホスト部分（Host がなければサーバー側の名前）
        if (!isLocalHost(request.getServerName())) {
            reject(response, HttpStatus.FORBIDDEN, "FORBIDDEN", "この PC 以外の宛先からは利用できません");
            return;
        }
        if (!SAFE_METHODS.contains(request.getMethod())) {
            if (!isFromThisApp(request)) {
                reject(response, HttpStatus.FORBIDDEN, "FORBIDDEN", "ほかのサイトからの操作は受け付けません");
                return;
            }
            if ("POST".equals(request.getMethod()) && !isJson(request.getContentType())) {
                reject(response, HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE",
                        "Content-Type は application/json にしてください");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    /** Host ヘッダーのホスト部分（ポートを除く）が、この PC を指しているか */
    static boolean isLocalHost(String hostHeader) {
        if (hostHeader == null || hostHeader.isBlank()) {
            return false;
        }
        String host = hostHeader.toLowerCase(Locale.ROOT);
        if (host.startsWith("[")) {
            int end = host.indexOf(']');
            return end > 0 && LOCAL_HOSTS.contains(host.substring(0, end + 1));
        }
        int colon = host.indexOf(':');
        return LOCAL_HOSTS.contains(colon >= 0 ? host.substring(0, colon) : host);
    }

    /** ブラウザが付ける送信元の情報から、Orbit 自身の画面から送られたかを判定する（情報がなければ許可） */
    private static boolean isFromThisApp(HttpServletRequest request) {
        String fetchSite = request.getHeader("Sec-Fetch-Site");
        if (fetchSite != null && !ALLOWED_FETCH_SITES.contains(fetchSite)) {
            return false;
        }
        String origin = request.getHeader("Origin");
        if (origin == null) {
            return true;
        }
        try {
            URI uri = URI.create(origin);
            // IPv6 の場合、getHost() は角かっこ付き（[::1]）で返る
            return uri.getHost() != null && isLocalHost(uri.getHost());
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static boolean isJson(String contentType) {
        if (contentType == null) {
            return false;
        }
        try {
            return MediaType.APPLICATION_JSON.isCompatibleWith(MediaType.parseMediaType(contentType));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static void reject(HttpServletResponse response, HttpStatus status, String code, String message)
            throws IOException {
        response.setStatus(status.value());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
