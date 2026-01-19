import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StompService } from '../stomp.service';
import { filter, take, tap } from 'rxjs';

@Component({
  selector: 'app-room',
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent implements OnInit {
  username = localStorage.getItem('username');
  usernameInput = '';
  currentRoom: string = '';

  private pc?: RTCPeerConnection;
  private localStream?: MediaStream;
  private remoteStream?: MediaStream;

  private servers: RTCConfiguration = {
    iceServers: [
      {
        urls: [
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
        ],
      },
    ],
  };

  constructor(
    private stompService: StompService,
    private router: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.router.queryParams.subscribe({
      next: (params: any) => {
        this.currentRoom = params.room;

        if (this.currentRoom) {
          this.stompService.stompConnected$
            .pipe(
              filter((val) => val),
              take(1),
            )
            .subscribe(() => {
              this.subscribeForData();

              this.stompService.subscribe(
                `/topic/room/${this.currentRoom}`,
                async (msg: any) => {
                  const payload = JSON.parse(msg.body);

                  // Ignore my own broadcast
                  if (payload.username === this.username) return;

                  if (payload.type === 'offer') {
                    await this.onOffer(payload.data);
                  }

                  if (payload.type === 'answer') {
                    await this.onAnswer(payload.data);
                  }

                  if (payload.type === 'candidate') {
                    await this.onCandidate(payload.data);
                  }
                },
              );
            });
        }
      },
    });
  }

  saveUsername() {
    window.localStorage.setItem('username', this.usernameInput);
    window.location.reload();
  }

  async startCall() {
    await this.ensureLocalStream();

    this.ensurePeerConnection();

    const offer = await this.pc!.createOffer();
    await this.pc?.setLocalDescription(offer);

    this.sendSignal('offer', offer);
  }

  private async onOffer(offer: RTCSessionDescriptionInit) {
    await this.ensureLocalStream();
    this.ensurePeerConnection();

    await this.pc!.setRemoteDescription(offer);

    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);

    this.sendSignal('answer', answer);
  }

  private async onAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.pc) return;

    if (!this.pc.currentRemoteDescription) {
      await this.pc.setRemoteDescription(answer);
    }
  }

  private async onCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (e) {
      console.error('addIceCandidate failed', e);
    }
  }

  private async ensureLocalStream() {
    if (this.localStream) return;

    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    const localVideo = document.getElementById('user-1') as HTMLVideoElement;
    localVideo.srcObject = this.localStream;
  }

  private ensurePeerConnection() {
    if (this.pc) return;

    this.pc = new RTCPeerConnection(this.servers);

    this.remoteStream = new MediaStream();
    const remoteVideo = document.getElementById('user-2') as HTMLVideoElement;
    remoteVideo.srcObject = this.remoteStream;

    this.localStream?.getTracks().forEach((track) => {
      this.pc?.addTrack(track, this.localStream!);
    });

    this.pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('candidate', event.candidate);
      }
    };
  }

  private sendSignal(type: 'offer' | 'answer' | 'candidate', data: any) {
    if (!this.currentRoom) return;

    this.stompService.publish(`/app/signal/${this.currentRoom}`, {
      type,
      data,
      username: this.username,
    });
  }

  hangup() {
    this.pc?.close();
    this.pc = undefined;

    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = undefined;

    this.remoteStream = undefined;

    const localVideo = document.getElementById(
      'user-1',
    ) as HTMLVideoElement | null;
    const remoteVideo = document.getElementById(
      'user-2',
    ) as HTMLVideoElement | null;
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
  }

  subscribeForData() {
    const topic = `/topic/room/${this.currentRoom}`;
    this.stompService.subscribe(topic, (msg: any) => {
      const payload = JSON.parse(msg.body);
      console.log('ROOM MESSAGE: ', payload);
    });
  }
}
