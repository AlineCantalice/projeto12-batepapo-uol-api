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

const participantSchema = joi.object({
    name: joi.string().required().pattern(new RegExp(/(-?([A-Z].\s)?([A-Z][a-z]+)\s?)+([A-Z]'([A-Z][a-z]+))?/i))
});

app.post('/participants', async (req, res) => {
    const { name } = req.body;

    const participants = await db.collection('participants').find({ name: name }).toArray();

    if (participants.length > 0) {
        return res.sendStatus(409);
    }

    const { error } = participantSchema.validate({ name: name });

    if (!error) {
        await db.collection('participants')
            .insertOne({
                name: name,
                lastStatus: Date.now()
            });

        await db.collection('messages')
            .insertOne({
                from: name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            })
        return res.sendStatus(201);
    }
    return res.sendStatus(422);
});

app.get('/participants', async (req, res) => {
    const participants = await db.collection('participants').find().toArray();
    return res.send(participants);
});

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    const time = dayjs().format('HH:mm:ss');

    const schema = joi.object().keys({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message'),
        from: joi.string().valid(from)
    });

    const { error } = schema.validate({ to: to, text: text, type: type, from: from });

    if (!error) {
        await db.collection('messages')
            .insertOne({
                from: from,
                to: to,
                text: text,
                type: type,
                time: time
            });
        return res.sendStatus(201);
    }
    return res.sendStatus(422);
});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query);
    const user = req.headers.user;
    const messages = await db.collection('messages').find().toArray();

    const filteredMessages = messages.filter(me => me.type === 'message' || me.to === user || me.from === user);

    if (limit && filteredMessages) {
        const others = filteredMessages.reverse().slice(0, limit);
        return res.send(others);
    }
    return res.send(filteredMessages);
});

app.post('/status', async (req, res) => {
    const user = req.headers.user;
    const participant = await db.collection('participants').find({ name: user }).toArray();
    console.log(participant)
    if (!participant) {
        return res.sendStatus(404);
    }

    await db.collection('participants').updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    return res.sendStatus(200);
});

app.listen(5000);