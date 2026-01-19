import { Injectable } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StompService {
  private client: Client;
  private stompConnected = new BehaviorSubject<any>(false);
  stompConnected$ = this.stompConnected.asObservable();

  constructor() {
    this.client = new Client({
      brokerURL: 'wss://web-rtc-mini-backend.onrender.com/ws',
      reconnectDelay: 5000,
      onConnect: () => {
        console.log('connected');
        this.stompConnected.next(true);
      },
    });

    this.connect();
  }

  connect() {
    if (this.client) {
      if (!this.client.active) {
        this.client.activate();
      }
    }
  }

  subscribe(destination: string, cb: any): StompSubscription {
    return this.client.subscribe(destination, cb);
  }

  publish(destination: string, body: any) {
    this.client.publish({
      destination,
      body: JSON.stringify(body),
    });
  }
}
