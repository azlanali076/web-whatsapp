const express = require('express');
const qrcode = require('qrcode');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
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
        authStrategy: new LocalAuth({clientId: req.query.id}),
        // restartOnAuthFail: true,
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', // <- this one doesn't works in Windows
                '--disable-gpu'
            ],
        },
    });
    client.on('qr',(qr) => {
        console.log('got qr code');
        qrcode.toDataURL(qr,(err,url) => {
            if(err){
                return res.json({success:false,error:err});
            }
            if(!res.headersSent){
                return res.render('index',{url,clientId: req.query.id});
            }
            else{
                io.emit('new_qr_'+req.query.id,url);
            }
        });
    });
    client.on('authenticated',(session) => {
        io.emit("auth_"+req.query.id,true)
    })
    client.on('auth_failure',() => {
        io.emit("auth_"+req.query.id,false)
    })
    client.on('message',(msg) => {
        io.emit('message_'+req.query.id,msg);
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

app.post('/logout',(req,res) => {
    if(req.query.id){
        whatsappClients[req.query.id].logout().then(() => {
            fs.rmdir('.wwebjs_auth/session-'+req.query.id,{recursive: true},(err) => {
                if(err){
                    return res.json({success: false,message: err});
                }
                whatsappClients[req.query.id] = null;
                return res.json({success:true,message:'Logout Done'});
            })
            
        }).catch(err => {
            return res.json({success: false,error: err});
        });
    }
    else{
        return res.json({error:'ID is Required'});
    }
});

server.listen(3020, () => {
  console.log('listening on *:3020');
});