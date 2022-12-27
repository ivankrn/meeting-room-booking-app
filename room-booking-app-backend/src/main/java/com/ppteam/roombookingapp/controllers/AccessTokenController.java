package com.ppteam.roombookingapp.controllers;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
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
    private AccessTokenStoreService accessTokenStoreService;

    /**
     * Сохраняет переданный токен доступа для дальнейшего использования.
     *
     * @param request ID пользователя и его токен доступа
     * @return 200 OK ответ сервера
     */
    @PostMapping("/token")
    public ResponseEntity<String> saveToken(@RequestBody String request) {
        JsonObject requestJson = JsonParser.parseString(request).getAsJsonObject();
        String userId = requestJson.get("userId").getAsString().substring(19, 36)
                        .replace("-", "");
        String accessToken = requestJson.get("accessToken").getAsString();
        accessTokenStoreService.setAccessTokenByUserId(userId, accessToken);
        return ResponseEntity.ok().body("");
    }

}
