package com.ppteam.roombookingapp.controllers;

import com.azure.identity.AuthorizationCodeCredential;
import com.azure.identity.AuthorizationCodeCredentialBuilder;
import com.azure.identity.ClientSecretCredential;
import com.azure.identity.ClientSecretCredentialBuilder;
import com.microsoft.graph.authentication.IAuthenticationProvider;
import com.microsoft.graph.authentication.TokenCredentialAuthProvider;
import com.microsoft.graph.requests.GraphServiceClient;
import com.ppteam.roombookingapp.RoomBookingAppApplication;
import okhttp3.Request;

import java.io.IOException;
import java.net.URL;
import java.util.Properties;
import java.util.concurrent.CompletableFuture;

public class GraphClientHelper {

    private static final Properties properties = new Properties();
    private static String clientId;
    private static String tenantId;
    private static String clientSecret;

    static {
        try {
            properties.load(RoomBookingAppApplication.class.getClassLoader().getResourceAsStream("oAuth.properties"));
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        clientId = properties.getProperty("app.clientId");
        tenantId = properties.getProperty("app.tenantId");
        clientSecret = properties.getProperty("app.clientSecret");
    }

    private GraphClientHelper() {
        throw new IllegalStateException("Static class");
    }

    public static GraphServiceClient<Request> getGraphClient(String accessToken) {
//        ClientSecretCredential clientSecretCredential = new ClientSecretCredentialBuilder()
//                .clientId(clientId)
//                .tenantId(tenantId)
//                .clientSecret(clientSecret)
//                .build();
        IAuthenticationProvider authProvider = new IAuthenticationProvider() {
            @Override
            public CompletableFuture<String> getAuthorizationTokenAsync(URL requestUrl) {
                CompletableFuture<String> future = new CompletableFuture<>();
                future.complete(accessToken);
                return future;
            }
        };
        //TokenCredentialAuthProvider authProvider = new TokenCredentialAuthProvider(List.of("https://graph.microsoft.com/.default"), authCodeCredential);
        GraphServiceClient graphServiceClient = GraphServiceClient.builder()
                .authenticationProvider(authProvider)
                .buildClient();
        return graphServiceClient;
    }
}
