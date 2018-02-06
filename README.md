# koa-session-mongo2

## Usage

```
npm install koa-session-mongo2
```

## Usage

```
var koa = require('koa');
var session = require('koa-session');
const MongoStore = require("koa-session-mongo2");

var app = koa();
app.use(session({
    store: new MongoStore({
        url: 'mongodb://localhost:27017',
        db:'user',
        collection: 'sessions',
        // 这里设置的是数据库session定期清除的时间，与cookie的过期时间应保持一致，cookie由浏览器负责定时清除，需要注意的是索引一旦建立修改的时候需要删除旧的索引。此处的时间是秒为单位，cookie的maxAge是毫秒为单位
        maxAge: 24 * 60 * 60
    }),
    signed:false,
    maxAge: 24 * 60 * 60 * 1000
},app))

app.listen(8080);
```

Then you can see document in user/sessions

## Options

- `url`:  required, MongoClient url   
- `db`:  optional, db Name, defaunt 'sessions'
- `collection`: optional, db session collection name,default  `__session`
- `maxAge`:  expireAfterSeconds,mongodb will delete the document after maxAge. default `10*24*3600` ten days.
