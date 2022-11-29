const express = require('express');
const qrcode = require('qrcode');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { Client, LocalAuth } = require('whatsapp-web.js');
const io = new Server(server);

let whatsappClients = {};

app.set('view engine','ejs');
app.use(express.json());

app.get('/', (req, res) => {
    if(!req.query.id){
        return res.json({error: '`id` in query is required'});
    }
    if(whatsappClients[req.query.id]){
        return res.render('index',{clientId: req.query.id,url:''});
    }
    console.log('creating client with id '+req.query.id);
    let client = new Client({
        authStrategy: new LocalAuth({clientId: req.query.id})
    });
    client.on('qr',(qr) => {
        console.log('got qr code');
        qrcode.toDataURL(qr,(err,url) => {
            if(err){
                return res.json({success:false,error:err});
            }
            return res.render('index',{url,clientId: req.query.id});
        });
    });
    client.on('authenticated',(session) => {
        io.emit("auth",true)
    })
    client.on('auth_failure',() => {
        io.emit("auth",false)
    })
    client.on('message',(msg) => {
        io.emit('message',msg);
    })
    client.initialize();
    whatsappClients[req.query.id] = client;
});

app.post('/send-message',(req,res) => {
    if(req.query.id){
        whatsappClients[req.query.id].sendMessage(req.body.number,req.body.message).then((value) => {
            return res.json({success:true,message:'Message Sent!'});
        }).catch(err => {
            return res.json({success: false,error: err});
        });
    }
    else{
        return res.json({error:'ID is Required'});
    }
});

io.on('connection', (socket) => {
  console.log('a user connected');
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});