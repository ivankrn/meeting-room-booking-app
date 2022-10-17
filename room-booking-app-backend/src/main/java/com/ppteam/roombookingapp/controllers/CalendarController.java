package com.ppteam.roombookingapp.controllers;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
@RequestMapping("/")
public class CalendarController {

    @GetMapping("/hello")
    public String sayHello() {
        return "Hello, world!";
    }

    @PostMapping("/echo")
    public void echo(@RequestBody String request) {
        System.out.println(request);
    }

    @GetMapping("/getTest")
    public ResponseEntity<String> getTest(@RequestHeader(HttpHeaders.AUTHORIZATION) String authHeader) {
        String token = authHeader.split(" ")[1];
        return new ResponseEntity<String>(getProfileDataFromGraph(token), HttpStatus.OK);
    }

    private static String getProfileDataFromGraph(String accessToken) {
        String GRAPH_URL = "https://graph.microsoft.com/v1.0/me";
        try {
            URL url = new URL(GRAPH_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();

            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setRequestProperty("Accept", "application/json");

            int httpResponseCode = conn.getResponseCode();
            if (httpResponseCode == HttpStatus.OK.value()) {

                StringBuilder response;
                try (BufferedReader in = new BufferedReader(
                        new InputStreamReader(conn.getInputStream()))) {

                    String inputLine;
                    response = new StringBuilder();
                    while ((inputLine = in.readLine()) != null) {
                        response.append(inputLine);
                    }
                }
                return response.toString();
            } else {
                return String.format("Connection returned HTTP code: %s with message: %s",
                        httpResponseCode, conn.getResponseMessage());
            }
        } catch (IOException e) {
            return "Something went wrong.";
        }
    }
}
