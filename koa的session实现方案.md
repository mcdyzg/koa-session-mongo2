<!--

## 前言

使用koa2很长一段时间了，犹记得koa升级到2之后，正统的koa-session迟迟不支持async/await，所以做记住登录一直用的是koa-session2和koa-session2-mongo这种第三方方案。猛地去看了下changelog，发现正宫koa-session终于支持了(支持好久了，就是没发现)，遂尝试改用koa-session方案。

## koa-session2方案

### 场景1：使用内存做session存储

写法：

```
const app = new Koa();
const session = require("koa-session2")
app.use(session({
    maxAge: 20 * 1000
}))
```

解析：

koa-session2默认将session的值存到内存中。如果设置了maxAge，当ajax请求或者页面请求返回时，Response Headers中将会有set-cookie属性：
```
set-cookie:koa:sess=c6e924a48654bf7cd0b8828bf2537579449510e47408158a; path=/; expires=Thu, 25 Jan 2018 03:07:42 GMT; httponly
```
此时浏览器中将会保存一份cookie，此cookie的Expires/Max-Age属性就是上面的设置的maxAge: `2018-01-25T03:12:09.419Z`。再看server方面：当ctx.session被赋值时，koa-session2将会把session信心保存在内存中(this.sessions)，但是只要服务器重启，内存中保存的session都会释放，所以即使用户的cookie未失效，登录信息也会丢失掉。如果服务器一直运行未重启，当超过maxAge指定的时间后，浏览器中的cookie将会被浏览器清除掉，那么再发送ajax请求或页面请求的时候Request Headers中就不会携带cookie: `Cookie:koa:sess=12c14b75b54400f5569f5ca9b93fa50eb811b632a8070adb`，服务器拿不到cookie就读取不到session，虽然session读取不到了，但是koa-session2会根据maxAge设置定时器定时删除内存中保存的过期session值，保证了服务器内存不会被爆。当然如果不设置maxAge,那么浏览器中保存的cookie的Expires/Max-Age属性值为Session，这就使得浏览器中保存的cookie永久生效，而server中的cookie也不会定时清除，当访问量大的时候，server的内存就会被爆。

[代码解析](https://juejin.im/post/5a6ad63d518825732b1a0eea)

### 场景2：使用mongo做session存储

写法：

```
const session = require("koa-session2")
const MongoStore = require("koa-session2-mongo")
app.use(session({
    store: new MongoStore({
        url:  DB_URL  // your mongodb url  required
        collection: optional, db session collection name,default "__session"
    }),
    maxAge: 20 * 1000
}))
```

解析：

通过使用koa-session2-mongo包，可以实现将session保存在mongo数据库中。与保存在内存中相比，无论服务器重启不重启，session将永远不会丢失，除非cookie过期失效了。小缺陷：当设置maxAge时，koa-session2-mongo创建字段的时候会使用maxAge设置expireAfterSeconds属性，这是mongo提供的过期自动删除本条记录的功能，但实际使用过程中并没有过期自动删除记录，导致数据库中存在很多过期的session无法清除。


## koa-session方案

### 场景1：使用cookie存储

写法：

```
const session = require("koa-session")
app.use(session({
    signed:false,
    maxAge: 20 * 1000
},app))
```

解析：

当给session赋值时，koa-session会将session值加密并设置成cookie:

```
Request Headers:
set-cookie:koa:sess=eyJuYW1lIjoyLCJfZXhwaXJlIjoxNTE2ODUyNzI1MTM3LCJfbWF4QWdlIjoyMDAwMH0=; path=/; expires=Thu, 25 Jan 2018 03:58:45 GMT; httponly
```

由浏览器来控制session的过期清除工作。也就是说如果我们把密码放在session里存储：`ctx.session.password = 123`，session中间件会将{password:123}加密(new Buffer(JSON.stringify({password:123})).toString('base64'))处理后返回给浏览器的cookie！这是很严重的问题，这样做十分容易被破解。当然存到cookie的好处也很大：就是即使服务器重启，session还是会保留直到过期为止。

### 场景2：使用mongo数据库存储session

写法：

```
const session = require("koa-session")
const MongoStore = require("koa-session-mongo2")
app.use(session({
    store: new MongoStore({
        url:  DB_URL  // your mongodb url  required
        collection: optional, db session collection name,default "__session"
        signed:false // if true, please set app.keys = ['...']
    }),
    signed:false,
    maxAge: 20 * 1000
},app))
```

解析：

由于koa-generic-session-mongo没有支持async/await，所以使用[koa-session-mongo2](https://github.com/mcdyzg/koa-session-mongo2.git)做store中间件。当给session赋值时，koa-session会将session保存在mongo数据库中，然后返回给cookie随机生成的sid，cookie保存这个sid，当发起请求时，server会根据sid到mongo中查询对应的session值，然后赋给ctx.session。同样koa-session-mongo2也没有删除过时session的功能，需要服务器跑定时任务手动删除。

综上：

使用koa-session+koa-session-mongo2实现了session存储比较方便，对于使用token的方式，减少了每次请求都要发送token的过程，适合一些对于安全性要求较低的项目。
