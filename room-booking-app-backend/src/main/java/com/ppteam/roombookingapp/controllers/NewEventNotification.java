package com.ppteam.roombookingapp.controllers;

import com.microsoft.graph.models.DateTimeTimeZone;
import com.microsoft.graph.models.Recipient;

public class NewEventNotification {

    public final String id;
    public final String subject;
    public final String start;
    public final String end;
    public final String organizer;

    public NewEventNotification(String id, String subject, DateTimeTimeZone start, DateTimeTimeZone end, Recipient organizer) {
        this.id = id;
        this.subject = subject;
        this.start = start.dateTime;
        this.end = end.dateTime;
        this.organizer = organizer.emailAddress.name;
    }
}
