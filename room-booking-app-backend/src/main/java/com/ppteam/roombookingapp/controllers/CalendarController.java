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

    @GetMapping("/getTest")
    public ResponseEntity<String> getTest(@RequestHeader(HttpHeaders.AUTHORIZATION) String authHeader) {
        String token = authHeader.split(" ")[1];
        return new ResponseEntity<String>(getCalendarDataFromGraph(token), HttpStatus.OK);
    }

    private static String getProfileDataFromGraph(String accessToken) {
        String graphUrl = "https://graph.microsoft.com/v1.0/me/";
        return getDataFromGraph(accessToken, graphUrl);
    }

    private static String getEventsDataFromGraph(String accessToken) {
        //String graphUrl = "https://graph.microsoft.com/v1.0/me/events?$select=subject,organizer,attendees,start,end,location";
        String graphUrl = "https://graph.microsoft.com/v1.0/users/1e44c7e14745c3dc/calendars/AQMkADAwATM0MDAAMS1lMmIwLWYwMzgtMDACLTAwCgBGAAADf0_304dHwUaczW1q4kHxBgcAoWjADDijxECWkr58J8U3zgAAAgEGAAAAoWjADDijxECWkr58J8U3zgAEITJXIQAAAA==/events?$select=subject,organizer,start,end";
        return getDataFromGraph(accessToken, graphUrl);
    }

    private static String getCalendarDataFromGraph(String accessToken) {
        String graphUrl = "https://graph.microsoft.com/v1.0/me/calendars/AQMkADAwATM0MDAAMS1lMmIwLWYwMzgtMDACLTAwCgBGAAADf0_304dHwUaczW1q4kHxBgcAoWjADDijxECWkr58J8U3zgAAAgEGAAAAoWjADDijxECWkr58J8U3zgAEE87dvQAAAA==/events";
        return getDataFromGraph(accessToken, graphUrl);
    }

    private static String getDataFromGraph(String accessToken, String graphUrl) {
        try {
            URL url = new URL(graphUrl);
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
