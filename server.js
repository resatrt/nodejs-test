var http = require('http')
var fs = require('fs')
var url = require('url')
var port = process.argv[2]

if (!port) {
    console.log('请指定端口号好不啦？\nnode server.js 8888 这样不会吗？')
    process.exit(1)
}

var server = http.createServer(function (request, response) {
    var parsedUrl = url.parse(request.url, true)
    var pathWithQuery = request.url
    var queryString = ''
    if (pathWithQuery.indexOf('?') >= 0) { queryString = pathWithQuery.substring(pathWithQuery.indexOf('?')) }
    var path = parsedUrl.pathname
    var query = parsedUrl.query
    var method = request.method

    /******** 从这里开始看，上面不要看 ************/

    console.log('有个傻子发请求过来啦！路径（带查询参数）为：' + pathWithQuery)

    if (path === '/') {
        let string = fs.readFileSync('./index.html', 'utf8')
        let cookie = request.headers.cookie.split('; ')
        let hash = {}
        for (let i = 0; i < cookie.length; i++) {
            let parts = cookie[i].split('=')
            let key = parts[0]
            let value = parts[1]
            hash[key] = value
        }
        let email = hash.sign_in_email

        let users = fs.readFileSync('./db/users', 'utf8')//读取出来的是字符串
        users = JSON.parse(users)      //将字符串转换为对象 
        let foundUser
        for (let i = 0; i < users.length; i++) {
            if (users[i].email === email) {
                foundUser = users[i]
                break
            }
        }
        console.log(foundUser)
        if(foundUser){
            string=string.replace('__password__',foundUser.password)
        }else{
             string=string.replace('__password__','不知道')
        }

        response.statusCode = 200
        response.setHeader('Content-Type', 'text/html;charset=utf-8')
        response.write(string)
        response.end()
    } else if (path === '/sign_up' && method === 'GET') {
        let string = fs.readFileSync('./sign_up.html', 'utf8')
        response.statusCode = 200
        response.setHeader('Content-Type', 'text/html;charset=utf-8')
        response.write(string)
        response.end()
    } else if (path === '/sign_up' && method === 'POST') {
        readBody(request).then((body) => {
            let strings = body.split('&')  //['email=1','password=2','password_conformitation=3']  
            let hash = {}
            strings.forEach((string) => { //string=='email=1'
                let parts = string.split('=')
                let key = parts[0]
                let value = parts[1]
                hash[key] = decodeURIComponent(value)//即 {'email':1,'password':2,'password_confirmation':3}
            })
            // let email = hash['email']
            // let password = hash['password']
            // let password_confirmation = hash['password_confirmation']
            let { email, password, password_confirmation } = hash //上面三行等价于这行，这是ES6写法
            console.log(email)
            if (email.indexOf('@') === -1) { //意思是email值里是否包含@字符，===-1就是表示没有
                response.statusCode = 400
                response.setHeader('Content-Type', 'application/json;charset=utf-8')
                response.write(`{   
                    "errors":{
                        "error" : "invalid"
                    }
                }`) //JSON格式
            } else if (password !== password_confirmation) {
                response.statusCode = 400
                response.setHeader('Content-Type', 'application/json;charset=utf-8')
                response.write('password not match')
            } else {
                let users = fs.readFileSync('./db/users', 'utf8')//读取出来的是字符串
                try {      //试一下句
                    users = JSON.parse(users)      //将字符串转换为对象 
                } catch (exception) {//如果有异常则执行下面这句
                    users = []
                }
                let inUse = false
                for (let i = 0; i < users.length; i++) { //users是从文件读取的
                    let user = users[i]
                    if (user.email === email) {   //email这个变量是用户输入后存放到这个变量里的
                        inUse = true
                        break;
                    }
                }
                if (inUse) {
                    response.statusCode = 400
                    response.setHeader('Content-Type', 'application/json;charset=utf-8')
                    response.write(`{   
                        "errors":{
                            "error" : "email in use"
                        }
                    }`)
                } else {
                    users.push({ 'email': email, 'password': password })
                    usersString = JSON.stringify(users) //将对象转换为字符串
                    fs.writeFileSync('./db/users', usersString)
                    response.statusCode = 200
                    response.write('sccuess')
                }
            }

            response.end()
        })

    } else if (path === '/sign_in' && method === 'GET') {
        let string = fs.readFileSync('./sign_in.html', 'utf8')
        response.statusCode = 200
        response.setHeader('Content-Type', 'text/html;charset=utf-8')
        response.write(string)
        response.end()
    } else if (path === '/sign_in' && method === 'POST') {
        readBody(request).then((body) => {
            let strings = body.split('&')  //['email=1','password=2']  
            let hash = {}
            strings.forEach((string) => { //string=='email=1'
                let parts = string.split('=')
                let key = parts[0]
                let value = parts[1]
                hash[key] = decodeURIComponent(value)
            })
            let { email, password } = hash
            let users = fs.readFileSync('./db/users', 'utf8')
            try {      //试一下句
                users = JSON.parse(users)      //将字符串转换为对象 
            } catch (exception) {//如果有异常则执行下面这句
                users = []
            }
            let found
            for (let i = 0; i < users.length; i++) { //users是从文件读取的
                if (users[i].email === email && users[i].password === password) {
                    //users里会存有很多个账号密码，以对象的形式放到数组里
                    found = true
                    break;
                }
            }
            if (found) {
                response.statusCode = 200
                response.setHeader('Set-Cookie', `sign_in_email=${email}`)
                //没有设置ID就用es6写法
            } else {
                response.statusCode = 401
            }
            response.end()

        })

    } else {
        response.statusCode = 404
        response.setHeader('Content-Type', 'text/html;charset=utf-8')
        response.write(`你输入的路径不存在对应的内容`)
        response.end()
    }

    function readBody(request) {
        return new Promise((resolve, reject) => {
            let body = []
            request.on('data', (chunk) => {
                body.push(chunk);
            }).on('end', () => {
                body = Buffer.concat(body).toString();
                resolve(body)
            })
        })
    }
    /******** 代码结束，下面不要看 ************/
})

server.listen(port)
console.log('监听 ' + port + ' 成功\n请用在空中转体720度然后用电饭煲打开 http://localhost:' + port)