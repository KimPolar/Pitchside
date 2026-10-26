import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './api.ts';
import { openDb, root } from './db.ts';

const db=openDb();
const app=createApp(db);
const dist=resolve(root,'dist');
if(existsSync(dist)) {
 app.use(express.static(dist));
 app.get('/{*path}',(_req,res)=>res.sendFile(resolve(dist,'index.html')));
}
const port=Number(process.env.PORT)||3001;
const server=app.listen(port,'127.0.0.1',()=>console.log(`피치사이드 http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
