package com.ppteam.roombookingapp.controllers;

import com.corundumstudio.socketio.AckRequest;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.DataListener;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.microsoft.graph.models.ChangeType;
import com.microsoft.graph.models.Subscription;
import com.microsoft.graph.requests.GraphServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
public class SubscriptionController {

    private final Logger log = LoggerFactory.getLogger(this.getClass());

    @Autowired
    private SubscriptionStoreService subscriptionStoreService;
    @Autowired
    private AccessTokenStoreService accessTokenStoreService;
    static final String notificationHost = "https://d10c-185-42-144-194.eu.ngrok.io";
    static final int subscriptionLifetimeInMinutes = 1;
    static final int handicapInSeconds = 3;
    private final SocketIOServer socketIOServer;

    public SubscriptionController(SocketIOServer socketIOServer) {
        this.socketIOServer = socketIOServer;
        this.socketIOServer.addEventListener("join_calendar_room", String.class, new DataListener<String>() {
            @Override
            public void onData(SocketIOClient client, String request, AckRequest ackRequest) throws Exception {
                JsonObject requestJson = JsonParser.parseString(request).getAsJsonObject();
                String userId = requestJson.get("userId").getAsString().substring(19, 36).replace("-", "");
                String calApiId = requestJson.get("calApiId").getAsString();
                log.info("Клиент {} создал комнату для календаря {}", client.getSessionId(), calApiId);
                client.joinRoom(calApiId);
                createSubForCalendarIfNotExists(calApiId, userId);
            }
        });
        this.socketIOServer.addEventListener("leave_calendar_room", String.class, new DataListener<String>() {
            @Override
            public void onData(SocketIOClient client, String calApiId, AckRequest ackRequest) throws Exception {
                log.info("Клиент {} покинул комнату для календаря {}", client.getSessionId(), calApiId);
                client.leaveRoom(calApiId);
            }
        });
    }

    /**
     * Создает подписку для указанного ID календаря Outlook и пользователя, если для данного ID календаря не существует
     * подписки.
     *
     * @param calendarApiId ID календаря Outlook
     * @param userId ID пользователя Outlook
     */
    public void createSubForCalendarIfNotExists(String calendarApiId, String userId) {
        if (subscriptionStoreService.hasActiveSubscriptionForCalendarId(calendarApiId) ||
                !accessTokenStoreService.hasAccessTokenForUserId(userId)) {
            return;
        }
        GraphServiceClient graphClient = GraphClientHelper.getGraphClient(accessTokenStoreService.getAccessTokenByUserId(userId));
        Subscription subscriptionRequest = new Subscription();
        subscriptionRequest.changeType = ChangeType.CREATED + ", " + ChangeType.UPDATED + ", " + ChangeType.DELETED;
        subscriptionRequest.notificationUrl = notificationHost + "/listen";
        subscriptionRequest.resource = "Users/" + userId + "/calendars/" + calendarApiId + "/events";
        subscriptionRequest.expirationDateTime = OffsetDateTime.now().plusMinutes(subscriptionLifetimeInMinutes);
        CompletableFuture<Subscription> subscriptionFuture =
                graphClient.subscriptions().buildRequest().postAsync(subscriptionRequest);
        subscriptionFuture.thenAccept(subscription -> {
            subscriptionStoreService.addSubscription(subscription.id, subscription.resource,
                    subscription.expirationDateTime, userId);
            log.info("Создана подписка: {} для ресурса: {}", subscription.id, subscription.resource);
        });
    }

    /**
     * Обновляет подписку для указанного ID календаря Outlook, используя переданный клиент Microsoft Graph.
     *
     * @param subscriptionId ID календаря Outlook
     * @param graphClient Клиент Microsoft Graph
     */
    public void updateSubscription(String subscriptionId, GraphServiceClient graphClient) {

        OffsetDateTime newExpirationDateTime = OffsetDateTime.now(ZoneOffset.UTC).plusMinutes(subscriptionLifetimeInMinutes);
        Subscription subscriptionToUpdate = new Subscription();
        subscriptionToUpdate.expirationDateTime = newExpirationDateTime;
        graphClient.subscriptions(subscriptionId).buildRequest().patchAsync(subscriptionToUpdate).thenAccept(subscription -> {
            log.info("Обновлена подписка: {}", subscription.id);
            subscriptionStoreService.updateSubscriptionExpirationDateTime(subscriptionId, newExpirationDateTime);
        });
    }

    /**
     * Обновляет все подписки, удаляя те, чей календарь не просматривается каким-либо пользователем.
     */
    @Scheduled(fixedRate = subscriptionLifetimeInMinutes * 60 * 1000 - handicapInSeconds * 1000)
    public void updateSubscriptions() {
        log.info("Начато обновление подписок");
        List<SubscriptionRecord> subscriptions = subscriptionStoreService.getAllSubscriptions();
        if (!subscriptions.isEmpty()) {
            for (SubscriptionRecord subscription : subscriptions) {
                String userId = subscription.resource.split("/")[1];
                if (accessTokenStoreService.hasAccessTokenForUserId(userId)) {
                    GraphServiceClient graphClient = GraphClientHelper
                            .getGraphClient(accessTokenStoreService.getAccessTokenByUserId(userId));
                    String calendarApiId = SubscriptionStoreService.getCalendarApiIdFromResource(subscription.resource);
                    if (!socketIOServer.getRoomOperations(calendarApiId).getClients().isEmpty()) {
                        updateSubscription(subscription.subscriptionId, graphClient);
                    } else {
                        deleteSubscription(calendarApiId, graphClient);
                    }
                }
            }
        }
    }

    /**
     * Удаляет подписку для указанного ID календаря Outlook, используя переданный клиент Microsoft Graph.
     *
     * @param calendarApiId ID календаря Outlook
     * @param graphClient Microsoft Graph клиент
     */
    public void deleteSubscription(String calendarApiId, GraphServiceClient graphClient) {
        List<SubscriptionRecord> subscriptions = subscriptionStoreService.getAllSubscriptions();
        for (SubscriptionRecord subscription : subscriptions) {
            String subscriptionCalendarApiId = SubscriptionStoreService.getCalendarApiIdFromResource(subscription.resource);
            if (Objects.equals(subscriptionCalendarApiId, calendarApiId)) {
                graphClient.subscriptions(subscription.subscriptionId)
                        .buildRequest().deleteAsync().thenRun( () -> {
                            log.info("Удалена подписка: {}", subscription.subscriptionId);
                            subscriptionStoreService.deleteSubscription(subscription.subscriptionId);
                });
            }
        }
    }

}
