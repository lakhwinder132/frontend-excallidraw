'use client';
import axios from "axios";
import { useEffect, useState } from "react";
const STORAGE_KEY = 'whiteboard_data';
import { useRouter } from "next/navigation";
import './page.css';

export default function Room(){
     const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [roomid, setRoomid] = useState<string | null>(null);

  useEffect(() => {

    const savedToken = window.localStorage.getItem("token");
    const savedRoom = window.localStorage.getItem("roomid");

    setToken(savedToken);
    setRoomid(savedRoom);

    if (!savedToken) {
      router.push("/signup");
      return;
    }

    if (!savedRoom) {
      router.push("/room");
      return;
    }

  }, [router]);
    

    return(<div>
        <div id='one'>
            <div>
                <input id='joinroom' placeholder="Join Room"></input>
                <button id="roomjoin" onClick={()=>{
                    async function l(){
                    const inputElement = document.getElementById('joinroom') as HTMLInputElement;
                    if(!inputElement){return;}
                    const romid = inputElement?.value;
                    if (!romid) return;
                    const findone=await axios.post(`${process.env.NEXT_PUBLIC_Backend_URL}/join`,{
                        roomid:romid,
                        token:token
                    });
                    const wdata=findone.data.whiteboarddata;
                    localStorage.setItem(STORAGE_KEY,wdata);
                    localStorage.setItem('roomid',romid);
                    }
                    l();
                    router.push('/dashboard');
                }}>Join</button>
            </div>
            <div>
                <button id="createroom" onClick={ ()=>{
                    async function d(){ 
                    const generateid=Math.random().toString();
                    const room = await axios.post(`${process.env.NEXT_PUBLIC_Backend_URL}/create`,{
                        roomid:generateid,
                        token:token
                    });
                    alert('roomid created-'+generateid);
                    localStorage.setItem('roomid',generateid);
                    localStorage.setItem(STORAGE_KEY,'');
                }
                d();
                 router.push('/dashboard');
                }}>CreateRoom</button>
            </div>
        </div>
    </div>)
}
