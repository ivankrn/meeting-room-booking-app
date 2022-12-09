package com.ppteam.roombookingapp.controllers;

import org.springframework.stereotype.Service;

@Service
public class AccessTokenService {

    private String accessToken;

    public String getAccessToken() {
        return this.accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

}
