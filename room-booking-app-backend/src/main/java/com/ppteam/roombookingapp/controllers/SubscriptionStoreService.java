package com.ppteam.roombookingapp.controllers;

import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class SubscriptionStoreService {

    private static final Map<String, SubscriptionRecord> subscriptions = new HashMap<>();
    private static final Set<String> currentlyUsedCalendars = new HashSet<>();

    /**
     * Добавляет в хранилище подписок подписку с указанным ID, ресурсом и датой окончания подписки, если подписки с
     * указанным ID нет в хранилище.
     *
     * @param id ID подписки
     * @param resource Ресурс подписки
     * @param expirationDateTime Дата истечения подписки
     */
    public void addSubscription(String id, String resource, OffsetDateTime expirationDateTime) {
        if (subscriptions.containsKey(id)) {
            return;
        }
        SubscriptionRecord newRecord =
                new SubscriptionRecord(id, resource, expirationDateTime);
        subscriptions.put(id, newRecord);
        String calendarApiId = getCalendarApiIdFromResource(resource);
        currentlyUsedCalendars.add(calendarApiId);
    }

    /**
     * Обновляет дату окончания подписки с указанным ID.
     *
     * @param subscriptionId ID подписки
     * @param newExpirationDateTime Новая дата окончания подписки
     * @return true, если дата подписки была обновлена, иначе false
     */
    public boolean updateSubscriptionExpirationDateTime(String subscriptionId, OffsetDateTime newExpirationDateTime) {
        if (subscriptions.containsKey(subscriptionId)) {
            SubscriptionRecord oldSubscription = subscriptions.get(subscriptionId);
            SubscriptionRecord newSubscription = new SubscriptionRecord(oldSubscription.subscriptionId,
                    oldSubscription.resource, newExpirationDateTime);
            subscriptions.put(subscriptionId, newSubscription);
            return true;
        }
        return false;
    }

    /**
     * Возвращает ID календаря Outlook по ресурсу подписки.
     *
     * @param resource Ресурс подписки
     * @return ID календаря Outlook
     */
    public static String getCalendarApiIdFromResource(String resource) {
        return resource.split("/")[2];
    }

    /**
     * Возвращает подписку по ID.
     *
     * @param subscriptionId ID подписки
     * @return Подписка с указанным ID
     */
    public SubscriptionRecord getSubscription(String subscriptionId) {
        return subscriptions.get(subscriptionId);
    }

    /**
     * Удаляет подписку с указанным ID.
     *
     * @param subscriptionId ID подписки
     */
    public void deleteSubscription(String subscriptionId) {
        currentlyUsedCalendars.remove(getCalendarApiIdFromResource(subscriptions.get(subscriptionId).resource));
        subscriptions.remove(subscriptionId);
    }

    /**
     * Возвращает все подписки.
     *
     * @return Все подписки
     */
    public List<SubscriptionRecord> getAllSubscriptions() {
        return new ArrayList<>(subscriptions.values());
    }

    /**
     * Возвращает true, если для указанного ID календаря Outlook уже существует подписка, иначе false.
     *
     * @param calendarApiId ID календаря Outlook
     * @return true, если для указанного ID календаря Outlook уже существует подписка, иначе false
     */
    public boolean hasActiveSubscriptionForCalendarId(String calendarApiId) {
        if (currentlyUsedCalendars.contains(calendarApiId))
            return true;
        return false;
    }

}
