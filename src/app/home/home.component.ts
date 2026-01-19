import { Component } from '@angular/core';
import { StompService } from '../stomp.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  constructor(
    private stompService: StompService,
    private router: Router,
  ) {}

  enterRoom(room: string) {
    this.router.navigate(['room'], {
      queryParams: { room: room },
    });
  }
}
