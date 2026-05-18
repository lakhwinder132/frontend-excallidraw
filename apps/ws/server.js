import { WebSocketServer } from "ws";
import { DataSchema } from "@repo/database";
import Connectdb from '@repo/database/dist/db.js';

const server=new WebSocketServer({
    port:3000
});

server.on('connection',(socket)=>{
    console.log('client connected');

    socket.on('message',async (message)=>{
        const room=JSON.parse(message.toString());
        const data =await DataSchema.findOneAndUpdate({
            roomid:room.roomid
        },{
            whiteboard_data:room.data
        });
        if(data.whiteboard_data){
        socket.send(JSON.stringify(data.whiteboard_data));
        }else{
         socket.send('');   
        }
    });
    socket.on('close',()=>{
        console.log('client disconnectd');
    });
});

console.log('server is running on port 8080');
