import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let db;
const client = new MongoClient(process.env.MONGO_URI);
const promise = client.connect().then(() => db = client.db('bate_papo'));

app.post('/participants', (req, res) => {
    const { name } = req.body;

    const schema = joi.object().keys({
        name: joi.string().required()
    });

    const { error, value } = schema.validate({ name: name });

    if (!error) {
        db.collection('participants')
            .insertOne({
                name: name,
                lastStatus: Date.now()
            }).then(res.sendStatus(201));
        return;
    }
    return res.sendStatus(422);
});

app.get('/participants', (req, res) => {
    db.collection('participants')
        .find().toArray().then(participants => {
            res.send(participants)
        })
});

app.post('/messages', (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    const time = dayjs().format('HH:mm:ss')

    const schema = joi.object().keys({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message'),
        from: joi.string().valid(from)
    });

    const { error, value } = schema.validate({ to: to, text: text, type: type, from: from });

    if (!error) {
        db.collection('messages')
            .insertOne({
                from: from,
                to: to,
                text: text,
                type: type,
                time: time
            }).then(res.sendStatus(201));
        return;
    }
    return res.sendStatus(422);
});

app.get('/messages', (req, res) => {
    const limit = req.query;
    const user = req.headers.user;
    db.collection('messages')
        .find().toArray().then(messages => {
            console.log(messages)
            res.send(messages)
        })
});

app.listen(5000);