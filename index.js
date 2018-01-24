const mongod = require("mongodb");
const { randomBytes } = require('crypto');
const log = console.log;

class MongoStore{
    constructor(opts) {
        this.init(opts);
    }

    async init({url, options, collection = "__session"}) {
        try {
            this.db = await mongod.MongoClient.connect(url, options);
            this.coll = await this.db.collection(collection);
            // let exist = await this.coll.indexExists(["access__idx"]);
            // if (!exist) {
            //     this.coll.createIndex({"lastAccess": 1}, {name: "access__idx", expireAfterSeconds: maxAge});
            // }
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
                "sid": key,
                "session": sess,
                "lastAccess": new Date(),
                // "maxAge": maxAge,
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
