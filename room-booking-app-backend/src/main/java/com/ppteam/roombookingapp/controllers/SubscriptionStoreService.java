package com.ppteam.roombookingapp.controllers;

import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class SubscriptionStoreService {

    private static final Map<String, SubscriptionRecord> subscriptions = new HashMap<>();
    private static final Set<String> currentlyUsedCalendars = new HashSet<>();

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

    public static String getCalendarApiIdFromResource(String resource) {
        return resource.split("/")[2];
    }

    public SubscriptionRecord getSubscription(String subscriptionId) {
        return subscriptions.get(subscriptionId);
    }

    public void deleteSubscription(String subscriptionId) {
        currentlyUsedCalendars.remove(getCalendarApiIdFromResource(subscriptions.get(subscriptionId).resource));
        subscriptions.remove(subscriptionId);
    }

    public List<SubscriptionRecord> getAllSubscriptions() {
        return new ArrayList<>(subscriptions.values());
    }

    public boolean hasActiveSubscriptionForCalendarId(String calendarApiId) {
        if (currentlyUsedCalendars.contains(calendarApiId))
            return true;
        return false;
    }

}
