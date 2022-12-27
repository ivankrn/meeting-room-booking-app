package com.ppteam.roombookingapp.controllers;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class AccessTokenStoreService {
    private final Map<String, String> accessTokenByUser = new HashMap<>();


    /**
     * Возвращает токен доступа для указанного ID пользователя.
     *
     * @param userId ID пользователя
     * @return Токен доступа
     */
    public String getAccessTokenByUserId(String userId) {
        return this.accessTokenByUser.get(userId);
    }

    /**
     * Сохраняет токен доступа для указанного ID пользователя.
     *
     * @param userId ID пользователя
     * @param accessToken Токен доступа
     */
    public void setAccessTokenByUserId(String userId, String accessToken) {
        this.accessTokenByUser.put(userId, accessToken);
    }

    /**
     * Возвращает true, если для данного ID пользователя имеется токен доступа, иначе false.
     *
     * @param userId ID пользователя
     * @return true, если для данного ID пользователя имеется токен доступа, иначе false
     */
    public boolean hasAccessTokenForUserId(String userId) {
        return accessTokenByUser.containsKey(userId);
    }

}
