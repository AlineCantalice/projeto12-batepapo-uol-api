import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import joi from 'joi';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

let db;
const client = new MongoClient(process.env.MONGO_URI);
const promise = client.connect().then(() => db = client.db('bate_papo'));

const schema = joi.object().keys({
    name: joi.string().required()
});

app.post('/participants', (req, res) => {
    const { name } = req.body;
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

});

app.get('/messages', (req, res) => {
    
});

app.listen(5000);