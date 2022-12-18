package com.ppteam.roombookingapp.controllers;

import com.corundumstudio.socketio.AckRequest;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.ConnectListener;
import com.corundumstudio.socketio.listener.DataListener;
import com.corundumstudio.socketio.listener.DisconnectListener;
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
    private AccessTokenService accessTokenService;
    static final String notificationHost = "https://8ba5-185-42-144-194.eu.ngrok.io";
    static final int subscriptionLifetimeInMinutes = 1;
    static final int handicapInSeconds = 3;
    private final SocketIOServer socketIOServer;

    public SubscriptionController(SocketIOServer socketIOServer) {
        this.socketIOServer = socketIOServer;

        this.socketIOServer.addConnectListener(new ConnectListener() {
            @Override
            public void onConnect(SocketIOClient socketIOClient) {
                log.info("Клиент {} подключился", socketIOClient.getSessionId());
            }
        });
        this.socketIOServer.addDisconnectListener(new DisconnectListener() {
            @Override
            public void onDisconnect(SocketIOClient socketIOClient) {
                log.info("Клиент {} отключился", socketIOClient.getSessionId());
            }
        });

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

    /**
     * Создает подписку для указанного ID календаря Outlook, если для данного ID не существует подписки.
     *
     * @param calendarApiId ID календаря Outlook
     */
    public void createSubForCalendarIfNotExists(String calendarApiId) {
        if (subscriptionStoreService.hasActiveSubscriptionForCalendarId(calendarApiId)) {
            return;
        }
        GraphServiceClient graphClient = GraphClientHelper.getGraphClient(accessTokenService.getAccessToken());
        Subscription subscriptionRequest = new Subscription();
        subscriptionRequest.changeType = ChangeType.CREATED + ", " + ChangeType.UPDATED + ", " + ChangeType.DELETED;
        subscriptionRequest.notificationUrl = notificationHost + "/listen";
        subscriptionRequest.resource = "me/calendars/" + calendarApiId + "/events";
        subscriptionRequest.expirationDateTime = OffsetDateTime.now().plusMinutes(subscriptionLifetimeInMinutes);
        CompletableFuture<Subscription> subscriptionFuture =
                graphClient.subscriptions().buildRequest().postAsync(subscriptionRequest);
        subscriptionFuture.thenAccept(subscription -> {
            subscriptionStoreService.addSubscription(subscription.id, subscription.resource, subscription.expirationDateTime);
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
            GraphServiceClient graphClient = GraphClientHelper.getGraphClient(accessTokenService.getAccessToken());
            for (SubscriptionRecord subscription : subscriptions) {
                String calendarApiId = SubscriptionStoreService.getCalendarApiIdFromResource(subscription.resource);
                if (!socketIOServer.getRoomOperations(calendarApiId).getClients().isEmpty()) {
                    updateSubscription(subscription.subscriptionId, graphClient);
                } else {
                    deleteSubscription(calendarApiId, graphClient);
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
