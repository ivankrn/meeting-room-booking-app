package com.ppteam.roombookingapp.controllers;

import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.ConnectListener;
import com.corundumstudio.socketio.listener.DisconnectListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.CompletableFuture;

@RestController
@CrossOrigin(origins = "http://localhost:4200")
public class ListenController {

    private final SocketIOServer socketIOServer;

    @Autowired
    public ListenController(SocketIOServer socketIOServer) {
        this.socketIOServer = socketIOServer;
        System.out.println(socketIOServer.getAllClients().isEmpty());
        this.socketIOServer.addConnectListener(new ConnectListener() {
            @Override
            public void onConnect(SocketIOClient socketIOClient) {
                System.out.println("Connected client id: " + socketIOClient.getSessionId());
            }
        });
        this.socketIOServer.addDisconnectListener(new DisconnectListener() {
            @Override
            public void onDisconnect(SocketIOClient socketIOClient) {
                System.out.println("Disconnected client id: " + socketIOClient.getSessionId());
            }
        });
    }

    @PostMapping(value = "/listen", headers = {"content-type=text/plain"})
    @ResponseBody
    public ResponseEntity<String> handleValidation(@RequestParam(value = "validationToken") String validationToken) {
        return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body(validationToken);
    }

    @PostMapping("/listen")
    public CompletableFuture<ResponseEntity<String>> handleNotification(@RequestBody String jsonPayload) {
        this.socketIOServer.getBroadcastOperations().sendEvent("schedule_update");
        return CompletableFuture.completedFuture(ResponseEntity.accepted().body(""));
    }

}
