package com.ppteam.roombookingapp.controllers;

import com.corundumstudio.socketio.SocketIOServer;
import com.google.gson.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
public class ListenController {

    @Autowired
    private SubscriptionStoreService subscriptionStoreService;
    private final SocketIOServer socketIOServer;

    @Autowired
    public ListenController(SocketIOServer socketIOServer) {
        this.socketIOServer = socketIOServer;
    }

    /**
     * Обрабатывает первичный запрос валидации, отправляемый Microsoft Graph при создании подписки.
     *
     * @param validationToken Токен валидации запроса
     * @return 200 OK ответ сервера с токеном валидации в теле ответа
     */
    @PostMapping(value = "/listen", headers = {"content-type=text/plain"})
    @ResponseBody
    public ResponseEntity<String> handleValidation(@RequestParam(value = "validationToken") String validationToken) {
        return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body(validationToken);
    }

    /**
     * Обрабатывает входящие уведомления Microsoft Graph об изменении расписания Outlook.
     *
     * @param jsonPayload Тело запроса
     * @return 202 Accepted ответ сервера
     */
    @PostMapping("/listen")
    public CompletableFuture<ResponseEntity<String>> handleNotification(@RequestBody String jsonPayload) {
        JsonArray notifications = parseNotificationStringToJsonArray(jsonPayload);
        if (notifications.isEmpty()) {
            return CompletableFuture.completedFuture(ResponseEntity.noContent().build());
        }
        for (JsonElement notification : notifications) {
            String subscriptionId = notification.getAsJsonObject().get("subscriptionId").getAsString();
            String calApiId = SubscriptionStoreService.getCalendarApiIdFromResource(
                    subscriptionStoreService.getSubscription(subscriptionId).resource);
            this.socketIOServer.getRoomOperations(calApiId).sendEvent("schedule_update");
        }
        return CompletableFuture.completedFuture(ResponseEntity.accepted().body(""));
    }

    private static JsonArray parseNotificationStringToJsonArray(String json) {
        return JsonParser.parseString(json).getAsJsonObject().get("value").getAsJsonArray();
    }

}
