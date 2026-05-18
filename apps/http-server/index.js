import express from 'express';
import cors from 'cors';
import Middleware from './middleware/index.js';
import  jwt from 'jsonwebtoken'; 
import dotenv from "dotenv";
dotenv.config();
import {UserSchema,DataSchema} from '@repo/database';

const app=express();
app.use(cors());
app.use(express.json());

app.post('/signup',async(req,res)=>{
    const {username,password}=req.body;
    const user=await UserSchema.create({
        username:username,
        password:password
    });
    res.send('signup successfully');
});

app.post('/signin',async (req,res)=>{
    const {username,password}=req.body;
    const user=await UserSchema.findOne({
        username:username,
        password:password
    });
    if(user){
     const token = jwt.sign({
        userId:user._id
     },process.env.JWT_SECRET);
     res.json({
        token:token
     });
    }else{
        res.send('Signup please');
    }
});

app.post('/join',Middleware,async (req,res)=>{
    const userID=req.userID;
    const roomid=req.body.roomid;
    const data=await DataSchema.findOne({
         roomid:roomid
    });
    res.json({
            whiteboarddata:data
        });
});

app.post('/create',Middleware,async (req,res)=>{
    const roomid=req.body.roomid;
    const datam=await DataSchema.create({
        roomid:roomid,
        whiteboard_data:""
    });
    if(datam){
        res.send('created');
    }else{
        res.send('not created');
    }
});

app.put('/edit',Middleware,async(req,res)=>{
    const userID=req.userID;
    const {roomid,wdata}=req.body;
    const insert=await DataSchema.updateOne({roomid:roomid},{whiteboard_data:wdata});
    if(insert){
        res.send('inserted data');
    }else{
        res.send('something went wrong');
    }
});

app.post('/',async (req,res)=>{
    const roomid=req.body.roomid;
    const data=await DataSchema.findOne({
        roomid:roomid
    });
    res.json({
        data:data
    });
})

app.listen(3000,()=>{
    console.log('http server running on port 3001');
});