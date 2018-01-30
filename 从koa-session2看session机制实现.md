<!--  
从koa-session2看session机制实现

## 使用场景

session机制通常是用来做记住用户登录信息的，借助cookie，从而实现用户登录信息长时间的保存。即使是用户浏览器关闭后又重新打开，只要cookie还在，就不用重新登录。

## 用法

const session = require("koa-session2")
const MongoStore = require("koa-session2-mongo")
app.use(session({
    store: new MongoStore({
        url:  DB_URL  // your mongodb url  required
        collection: optional, db session collection name,default "__session"
    }),
    maxAge: 24 * 60 * 60 * 1000  // one day
}))

## 源码

```
const Store = require('./libs/store.js');

module.exports = (opts = {}) => {
    const { key = "koa:sess", store = new Store() } = opts;

    return async (ctx, next) => {
        let id = ctx.cookies.get(key, opts);

        if(!id) {
            ctx.session = {};
        } else {
            ctx.session = await store.get(id, ctx);
            // check session must be a no-null object
            if(typeof ctx.session !== "object" || ctx.session == null) {
                ctx.session = {};
            }
        }

        const old = JSON.stringify(ctx.session);

        await next();

        // if not changed
        if(old == JSON.stringify(ctx.session)) return;

        // if is an empty object
        if(ctx.session instanceof Object && !Object.keys(ctx.session).length) {
            ctx.session = null;
        }

        // need clear old session
        if(id && !ctx.session) {
            await store.destroy(id, ctx);
            return;
        }

        // set/update session
        const sid = await store.set(ctx.session, Object.assign({}, opts, {sid: id}), ctx);
        ctx.cookies.set(key, sid, opts);
    }
}

// Reeexport Store to not use reference to internal files
module.exports.Store = Store;
```

## 解析

首先作为一个中间件，执行后应该返回一个async函数，这个async函数会接收到ctx和next对象。

当请求到来并执行到本中间件时，首先会根据我们设置的key从cookie获取对应的值：

```
session({
    key:'koa:sess',  
})
```

此处的key设置为koa-sess，因此执行`let id = ctx.cookies.get(key, opts)`的时候我们就获取到了cookie中保存的值，也就是这里的id。

如果id不存在，令ctx.session = {}等于空对象。如果id存在的话，从store中找到本id对应的session对象。可以认为此处的store就是一个用于保存数据的对象。一条完整的session对象如下

```
{
    "sid" : "3b2cd0807aa48a0294bb1cfe80f2d8d5fe9590c1746b4c2a",
    "session" : {
        "name" : "haha",
        "pwd" : "123"
    },
    "lastAccess" : ISODate("2018-01-25T06:57:06.413+0000")
}
```

对象中的sid就是我们从cookie中获取到的那个id。这样cookie中只存id，而真正的用户信息存在store中，避免了cookie遭破解用户信息泄露。

然后将session对象赋给ctx.session，然后await next()执行后面的中间件。当其他中间件执行完毕后，比较ctx.session对象时候发生改变(如controller中是否增删改了某些值)。如果ctx.session没有变化直接return不再处理。如果id不存在并且ctx.session不是空对象，那么创建一条新的session记录，然后将创建的记录sid通过cookie返回给浏览器
```
ctx.cookies.set(key, sid, opts);
```

如果id存在(说明已经创建过)但ctx.session为空对象，删除对象的session记录。

## koa-session2 store的实现

koa-session2中间件默认实现了一个store，使用的是Map对象。

### 源码

```
const { randomBytes } = require('crypto');

class Store {
    constructor() {
        this.sessions = new Map();
        this.__timer = new Map();
    }

    getID(length) {
        return randomBytes(length).toString('hex');
    }

    get(sid) {
        if (!this.sessions.has(sid)) return undefined;
        // We are decoding data coming from our Store, so, we assume it was sanitized before storing
        return JSON.parse(this.sessions.get(sid));
    }

    set(session, { sid =  this.getID(24), maxAge } = {}) {
        // Just a demo how to use maxAge and some cleanup
        if (this.sessions.has(sid) && this.__timer.has(sid)) {
            const __timeout = this.__timer.get(sid);
            if (__timeout) clearTimeout(__timeout);
        }

        if (maxAge) {
            this.__timer.set(sid, setTimeout(() => this.destroy(sid), maxAge));
        }
        try {
            this.sessions.set(sid, JSON.stringify(session));
        } catch (err) {
            console.log('Set session error:', err);
        }

        return sid;
    }

    destroy(sid) {
        this.sessions.delete(sid);
        this.__timer.delete(sid);
    }
}

module.exports = Store;
```

### 解析

koa-session2默认使用Store的实例存储session。

Store构造函数里`this.sessions = new Map()`创建了一个Map对象，this.sessions就是所有sessions存储的地方。

然后`this.__timer = new Map()`又创建了一个Map对象，this.__timer用来存储定时器，如果我们设置了maxAge，就会开启一个定时器定时清除session记录。

接下来get方法：

```
get(sid) {
   if (!this.sessions.has(sid)) return undefined;
   // We are decoding data coming from our Store, so, we assume it was sanitized before storing
   return JSON.parse(this.sessions.get(sid));
}
```

很简单，如果this.sessions有sid对应的值，返回，如果没有返回undefined。

接下来set方法：

```
set(session, { sid =  this.getID(24), maxAge } = {}) {
    if (this.sessions.has(sid) && this.__timer.has(sid)) {
        const __timeout = this.__timer.get(sid);
        if (__timeout) clearTimeout(__timeout);
    }

    if (maxAge) {
        this.__timer.set(sid, setTimeout(() => this.destroy(sid), maxAge));
    }
    try {
        this.sessions.set(sid, JSON.stringify(session));
    } catch (err) {
        console.log('Set session error:', err);
    }

    return sid;
}
```

如果没有sid(创建而不是更新session)，新建一个24位长的字符串作为sid。如果sessions和__timer中都存有sid的记录，先清除__timer中保存的定时器。如果maxAge存在的话，新建一个定时器定时删除session。最后用sid和ctx.session中保存的对象 新建或更新Map记录。

最后destroy方法：

```
destroy(sid) {
    this.sessions.delete(sid);
    this.__timer.delete(sid);
}
```

清除sessions和__timer中的session记录

### 缺点

1. 默认的store在内存中保存session数据，如果服务器重启将会丢失掉。

2. 如果用户量大将会爆内存。

## koa-session2-mongo做store

koa-session2-mongo中间件的实现思路与默认Store相同，只不过是将数据存到了数据库里。使用mongo存储session信息。避免了重启和爆内存问题。但这个中间件里定时清除session的地方有时没生效，需要server跑定时任务手动清除过期session

## 综上

koa-session2中间件已经能够实现基本的session存储。

如果需要功能更加强大的中间件，推荐koa官方的koa-session，当然如果想要存到mongo里，可以使用[koa-session-mongo2](https://github.com/mcdyzg/koa-session-mongo2.git)这个中间件。
