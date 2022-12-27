package com.ppteam.roombookingapp.controllers;

import com.corundumstudio.socketio.SocketIOServer;
import com.google.gson.*;
import com.microsoft.graph.http.GraphServiceException;
import com.microsoft.graph.models.Event;
import com.microsoft.graph.requests.GraphServiceClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.CompletableFuture;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
public class ListenController {

    @Autowired
    private SubscriptionStoreService subscriptionStoreService;
    @Autowired
    private AccessTokenStoreService accessTokenStoreService;
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
            if (!subscriptionStoreService.hasSubscriptionWithId(subscriptionId)) {
                continue;
            }
            String calApiId = SubscriptionStoreService.getCalendarApiIdFromResource(
                    subscriptionStoreService.getSubscription(subscriptionId).resource);
            String changeType = notification.getAsJsonObject().get("changeType").getAsString();
            String resource = notification.getAsJsonObject().get("resource").getAsString();
            String userId = resource.split("/")[1];
            if (accessTokenStoreService.hasAccessTokenForUserId(userId)) {
                if (Objects.equals(changeType, "created")) {
                    GraphServiceClient<okhttp3.Request> graphClient = GraphClientHelper.getGraphClient(
                            accessTokenStoreService.getAccessTokenByUserId(userId));
                    graphClient.customRequest("/" + resource + "/", Event.class).buildRequest().getAsync()
                            .thenAccept(event -> {
                                socketIOServer.getRoomOperations(calApiId)
                                        .sendEvent("add_event", new NewEventNotification(event.id, event.subject,
                                                event.start, event.end, event.organizer));
                            });
                } else if (Objects.equals(changeType, "updated")) {
                    GraphServiceClient<okhttp3.Request> graphClient = GraphClientHelper.getGraphClient(
                            accessTokenStoreService.getAccessTokenByUserId(userId));
                    graphClient.customRequest("/" + resource + "/", Event.class).buildRequest().getAsync()
                            .whenComplete((event, exception) -> {
                                if (exception != null && exception.getCause() instanceof GraphServiceException) {
                                    if (Objects.equals(((GraphServiceException) exception.getCause()).getError().error.code,
                                            "ErrorItemNotFound")) {
                                        String eventId = resource.split("/")[3];
                                        socketIOServer.getRoomOperations(calApiId).sendEvent("delete_event", eventId);
                                    }
                                } else {
                                    socketIOServer.getRoomOperations(calApiId)
                                            .sendEvent("update_event", new NewEventNotification(event.id, event.subject,
                                                    event.start, event.end, event.organizer));
                                }
                            });
                } else {
                    String eventId = resource.split("/")[3];
                    socketIOServer.getRoomOperations(calApiId).sendEvent("delete_event", eventId);
                }
            }
        }
        return CompletableFuture.completedFuture(ResponseEntity.accepted().body(""));
    }

    /**
     * Преобразует уведомление из строки Json в массив объектов Json.
     *
     * @param json Уведомление в виде строке Json
     * @return Уведомление в виде массива объектов Json
     */
    private static JsonArray parseNotificationStringToJsonArray(String json) {
        return JsonParser.parseString(json).getAsJsonObject().get("value").getAsJsonArray();
    }
}
