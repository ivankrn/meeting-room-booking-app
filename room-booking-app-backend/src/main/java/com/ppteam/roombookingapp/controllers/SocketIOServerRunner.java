package com.ppteam.roombookingapp.controllers;

import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class SocketIOServerRunner implements CommandLineRunner {

    private final SocketIOServer socketIOServer;

    @Autowired
    public SocketIOServerRunner(SocketIOServer server) {
        socketIOServer = server;
    }

    @Override
    public void run(String... args) throws Exception {
        socketIOServer.start();
    }
}
