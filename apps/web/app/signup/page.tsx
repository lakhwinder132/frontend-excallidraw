'use client';
import './signup.css';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function signup(){
    const navigate=useRouter();
    return(<div>
        <div id='signup'>
            <div>
                <p>Signup</p>
            </div>
            <div>
                <input id='username' placeholder="Username"></input>
            </div>
            <div>
                <input id='password' type='password' placeholder="Password"></input>
            </div>
            <div>
                <button onClick={async ()=>{
                  const username = (document.getElementById('username') as HTMLInputElement )?.value ?? '';
                  const password = (document.getElementById('password') as HTMLInputElement)?.value ?? '';
                  const sending = await axios.post(`${process.env.NEXT_PUBLIC_Backend_URL}/signup`,{
                    username: username,
                    password: password
                  });
                navigate.push('/signin');
                }}>SUBMIT</button>
            </div>
        </div>
    </div>)
}

