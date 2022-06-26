import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import joi from 'joi';
import dayjs from 'dayjs';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let db;
const client = new MongoClient(process.env.MONGO_URI);
client.connect().then(() => db = client.db('bate_papo'));

//  PARTICIPANTS ROUTES

app.post('/participants', async (req, res) => {
    const { name } = req.body;

    const schema = joi.object({
        name: joi.string().required().pattern(new RegExp(/(-?([A-Z].\s)?([A-Z][a-z]+)\s?)+([A-Z]'([A-Z][a-z]+))?/i))
    });

    const participants = await db.collection('participants').findOne({ name: name });

    if (participants) {
        return res.sendStatus(409);
    }

    const { error } = schema.validate({ name: name });

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

//  MESSAGES ROUTES

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;
    const time = dayjs().format('HH:mm:ss');
    const user = await db.collection('participants').findOne({ name: from });

    const schema = joi.object().keys({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message'),
        from: joi.string().valid(from)
    });

    if (user) {
        const { error } = schema.validate({ to: to, text: text, type: type, from: user.name });

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
    }

    return res.sendStatus(422);
});

app.get('/messages', async (req, res) => {
    const limit = parseInt(req.query);
    const user = req.headers.user;
    const messages = await db.collection('messages').find().toArray();

    const filteredMessages = messages.filter(me => me.type === 'message' || me.type === 'status' || me.to === user || me.from === user);

    if (limit && filteredMessages) {
        const others = filteredMessages.reverse().slice(0, limit);
        return res.send(others);
    }
    return res.send(filteredMessages);
});

app.put('/messages/:id', async (req, res) => {
    const id = req.params.id;
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

    if (error) {
        return res.sendStatus(422);
    }

    const message = await db.collection('messages').findOne({ _id: new ObjectId(id) });

    if (!message) {
        return res.sendStatus(404);
    }

    if (message.from === from) {

        await db.collection('messages').updateOne({ _id: new ObjectId(id) }, {
            $set:
            {
                from: from,
                to: to,
                text: text,
                type: type,
                time: time
            }
        });

        return res.sendStatus(201);
    }

    return res.sendStatus(401);

});

app.delete('/messages/:id', async (req, res) => {
    const user = req.headers.user;
    const id = req.params.id;

    const message = await db.collection('messages').findOne({ _id: new ObjectId(id) });

    if (!message) {
        return res.sendStatus(404);
    }

    if (message.from === user) {
        await db.collection('messages').deleteOne({ _id: new ObjectId(id) });
        return res.sendStatus(200);
    }

    return res.sendStatus(401);
});

//  STATUS ROUTE

app.post('/status', async (req, res) => {
    const user = req.headers.user;
    const participant = await db.collection('participants').findOne({ name: user });
    if (!participant) {
        return res.sendStatus(404);
    }

    await db.collection('participants').updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    return res.sendStatus(200);
});

//  FUNCTION

setInterval(async () => {
    try {
        const participants = await db.collection('participants').find().toArray();

        for (let i = 0; i < participants.length; i++) {
            if (participants[i].lastStatus <= (Date.now() - 10000)) {

                const deletedMessage =
                {
                    to: "Todos",
                    from: participants[i].name,
                    text: "sai da sala...",
                    type: "status",
                    time: dayjs().format("HH:mm:ss")
                }

                await db.collection('participants').deleteOne({ _id: new ObjectId(participants[i]._id) });

                await db.collection('messages').insertOne(deletedMessage);
            }
        }
    } catch (e) {
        console.log(e);
    }
}, 15000);

app.listen(5000);