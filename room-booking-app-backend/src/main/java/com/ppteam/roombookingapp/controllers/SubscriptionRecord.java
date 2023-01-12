package com.ppteam.roombookingapp.controllers;

import java.time.OffsetDateTime;

public class SubscriptionRecord {

    public final String subscriptionId;
    public final String resource;
    public final OffsetDateTime expirationDateTime;
    public final String userId;

    public SubscriptionRecord(String subscriptionId, String resource, OffsetDateTime expirationDateTime, String userId) {
        this.subscriptionId = subscriptionId;
        this.resource = resource;
        this.expirationDateTime = expirationDateTime;
        this.userId = userId;
    }

}
