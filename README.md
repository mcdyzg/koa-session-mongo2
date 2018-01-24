# koa-session-mongoDB

## Usage

```
npm install koa-session2-mongo
```

## Usage

```
var koa = require('koa');
var session = require('koa-session');
const MongoStore = require("koa-session-mongoDB");

var app = koa();
app.use(session({
    store: new MongoStore({
        url: DB_URL,
        collection: 'sessions',
    }),
    signed:false,
    maxAge: 24 * 60 * 60 * 1000
},app))

app.listen(8080);
```

## Options

- `url`:  required, db url   
- `collection`: optional, db session collection name,default  "__session"
