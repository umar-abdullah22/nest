import { Inject, Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
@WebSocketGateway({
  transports: ['websocket'],
  cors: {
    origin: [`http://localhost:3001`, `https://webrtdemo.netlify.app`],
  },
})
@Injectable()
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  connectedClients = new Map<string, Socket>();
  rooms = new Map<string, string[]>();

  afterInit(server: any) {
    console.log('Initialized');
  }

  async handleConnection(socket: Socket, _: any) {
    console.log('connected', socket.id);
    this.connectedClients.set(socket.id, socket);

    // Find an available room or create a new one
    let assignedRoom = '';
    for (const [room, users] of this.rooms.entries()) {
      if (users.length < 2) {
        users.push(socket.id);
        assignedRoom = room;
        break;
      }
    }

    if (!assignedRoom) {
      assignedRoom = `room-${Math.floor(Math.random() * 10000)}`;
      this.rooms.set(assignedRoom, [socket.id]);
    }

    socket.join(assignedRoom);
    socket.emit('connection', {
      status: 'connection-success',
      socketId: socket.id,
      room: assignedRoom,
    });
  }

  async handleDisconnect(socket: Socket) {
    console.log('disconnected', socket.id);

    // Remove the disconnected client from connectedClients
    this.connectedClients.delete(socket.id);

    // Find the room the disconnected client was in and remove them from the room
    let roomToRemove = '';
    for (const [room, clients] of this.rooms.entries()) {
      if (clients.includes(socket.id)) {
        roomToRemove = room;
        const updatedClients = clients.filter((client) => client !== socket.id);
        this.rooms.set(room, updatedClients as [string, string]);
        break;
      }
    }

    // If the room has no clients left, delete the room
    if (this.rooms.get(roomToRemove).length === 0) {
      this.rooms.delete(roomToRemove);
    }
  }
  @SubscribeMessage('sdp')
  async createOffer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    // console.log(data);
    socket.broadcast.emit('sdp', data);
  }
  @SubscribeMessage('candidate')
  async addCandidate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: any,
  ) {
    console.log(data);
    socket.broadcast.emit('candidate', data);
  }
}
