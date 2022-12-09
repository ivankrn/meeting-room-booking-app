package com.ppteam.roombookingapp.controllers;

import com.corundumstudio.socketio.AckRequest;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.DataListener;
import com.microsoft.graph.models.ChangeType;
import com.microsoft.graph.models.Subscription;
import com.microsoft.graph.requests.GraphServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
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
    private AccessTokenService accessTokenService;
    static final String notificationHost = "https://289f-185-42-144-194.eu.ngrok.io";
    static final int subscriptionLifetimeInMinutes = 1;
    static final int handicapInSeconds = 3;
    private final SocketIOServer socketIOServer;

    public SubscriptionController(SocketIOServer socketIOServer) {
        this.socketIOServer = socketIOServer;
        this.socketIOServer.addEventListener("join_calendar_room", String.class, new DataListener<String>() {
            @Override
            public void onData(SocketIOClient client, String calApiId, AckRequest ackRequest) throws Exception {
                log.info("Клиент {} создал комнату для календаря {}", client.getSessionId(), calApiId);
                client.joinRoom(calApiId);
                createSubForCalendarIfNotExists(calApiId);
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

    public CompletableFuture<ResponseEntity<String>> createSubForCalendarIfNotExists(@RequestBody String calendarApiId) {
        if (subscriptionStoreService.hasActiveSubscriptionForCalendarId(calendarApiId)) {
            return CompletableFuture.completedFuture(ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .body("Для данного календаря уже существует подписка."));
        }
        GraphServiceClient graphClient = GraphClientHelper.getGraphClient(accessTokenService.getAccessToken());
        Subscription subscriptionRequest = new Subscription();
        subscriptionRequest.changeType = ChangeType.CREATED + ", " + ChangeType.UPDATED + ", " + ChangeType.DELETED;
        subscriptionRequest.notificationUrl = notificationHost + "/listen";
        subscriptionRequest.resource = "me/calendars/" + calendarApiId + "/events";
        subscriptionRequest.expirationDateTime = OffsetDateTime.now().plusMinutes(subscriptionLifetimeInMinutes);
        CompletableFuture<Subscription> subscriptionFuture =
                graphClient.subscriptions().buildRequest().postAsync(subscriptionRequest);
        return subscriptionFuture.thenApply(subscription -> {
            subscriptionStoreService.addSubscription(subscription.id, subscription.resource, subscription.expirationDateTime);
            log.info("Создана подписка: {} для ресурса: {}", subscription.id, subscription.resource);
            return ResponseEntity.ok().body("");
        });
    }

    public void updateSubscription(String subscriptionId, GraphServiceClient graphClient) {

        SubscriptionRecord oldSubscription = subscriptionStoreService.getSubscription(subscriptionId);
        OffsetDateTime newExpirationDateTime = oldSubscription.expirationDateTime.plusMinutes(subscriptionLifetimeInMinutes);
        Subscription subscriptionToUpdate = new Subscription();
        subscriptionToUpdate.expirationDateTime = newExpirationDateTime;
        graphClient.subscriptions(subscriptionId).buildRequest().patchAsync(subscriptionToUpdate).thenAccept(subscription -> {
            log.info("Обновлена подписка: {}", subscription.id);
            subscriptionStoreService.updateSubscriptionExpirationDateTime(subscriptionId, newExpirationDateTime);
        });
    }

    @Scheduled(fixedRate = subscriptionLifetimeInMinutes * 60 * 1000 - handicapInSeconds * 1000)
    public void updateSubscriptions() {
        log.info("Начато обновление подписок");
        List<SubscriptionRecord> subscriptions = subscriptionStoreService.getAllSubscriptions();
        if (!subscriptions.isEmpty()) {
            GraphServiceClient graphClient = GraphClientHelper.getGraphClient(accessTokenService.getAccessToken());
            for (SubscriptionRecord subscription : subscriptions) {
                String calendarApiId = SubscriptionStoreService.getCalendarApiIdFromResource(subscription.resource);
                if (!socketIOServer.getRoomOperations(calendarApiId).getClients().isEmpty()) {
                    updateSubscription(subscription.subscriptionId, graphClient);
                } else {
                    deleteSubscription(calendarApiId);
                }
            }
        }
    }

    public void deleteSubscription(@RequestBody String calendarApiId) {
        GraphServiceClient graphClient = GraphClientHelper.getGraphClient(accessTokenService.getAccessToken());
        List<SubscriptionRecord> subscriptions = subscriptionStoreService.getAllSubscriptions();
        String calendarAsResource = "me/calendars/" + calendarApiId + "/events";
        for (SubscriptionRecord subscription : subscriptions) {
            if (Objects.equals(subscription.resource, calendarAsResource)) {
                graphClient.subscriptions(subscription.subscriptionId)
                        .buildRequest().deleteAsync().thenRun( () -> {
                            log.info("Удалена подписка: {}", subscription.subscriptionId);
                            subscriptionStoreService.deleteSubscription(subscription.subscriptionId);
                });
            }
        }
    }

}
