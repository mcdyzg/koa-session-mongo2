const mongod = require("mongodb");
const { randomBytes } = require('crypto');
const log = console.log;

class MongoStore{
    constructor(opts) {
        this.init(opts);
    }

    async init({url, db = "sessions", options, collection = "__session",maxAge = 10 * 24 * 3600}) {
        try {
            this.client = await mongod.MongoClient.connect(url);
            this.db = await this.client.db(db);
            this.coll = await this.db.collection(collection)
            try {
                // 查看是否创建过索引
                await this.coll.indexExists(["access__idx"]);
            } catch (e) {
                // 如果没有创建新的索引
                await this.coll.createIndex({"lastAccess": 1}, {name: "access__idx", expireAfterSeconds: maxAge});
            }
        } catch (e) {
            log(e.message);
        }
    }

    async get(key, maxAge, { rolling }) {
        // console.log(arguments,'get')
        try {
            let doc = await this.coll.findOne({sid: key});
            return doc ? doc.session : undefined;
        } catch (e) {
            log(e.message);
        }
    }

    async set(key, sess, maxAge, {rolling,changed}) {
        // console.log(arguments,'set')
        try {
            await this.coll.updateOne({"sid": key}, {
                $set:{
                    "sid": key,
                    "session": sess,
                    "lastAccess": new Date(),
                    // "maxAge": maxAge,
                }
            }, {upsert: true});
        } catch (e) {
            log(e.message);
        }
        return key;
    }

    async destroy(sid) {
        // console.log(arguments,333)
        try {
            await this.coll.deleteOne({sid: sid});
        } catch (e) {
            log(e.message);
        }
    }
}

module.exports = MongoStore;
