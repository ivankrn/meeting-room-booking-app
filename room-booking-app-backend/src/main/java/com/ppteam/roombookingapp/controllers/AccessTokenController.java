package com.ppteam.roombookingapp.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@Controller
@CrossOrigin(origins = "http://localhost:4200")
public class AccessTokenController {

    @Autowired
    private AccessTokenService accessTokenService;

    @PostMapping("/token")
    public ResponseEntity<String> saveToken(@RequestBody String accessToken) {
        accessTokenService.setAccessToken(accessToken);
        return ResponseEntity.ok().body("");
    }

}
